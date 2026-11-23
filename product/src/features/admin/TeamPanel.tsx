import { useFeedbackNotice } from "@/components/ui/useFeedbackNotice";
import { TeamSkeleton } from "./AdminSkeletons";
import { permissionLabels as labels } from "../../../shared/access";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { teamSchema, staffPermission } from "../../../shared/team";

const resultSchema = z.object({ success: z.literal(true) });
const permissionGroups = [
  {
    prefix: "users:",
    title: "Account directory",
    hint: "Names, email addresses, verification status and team roles.",
  },
  {
    prefix: "records:",
    title: "Reference records",
    hint: "All records in the optional demonstration module.",
  },
  {
    prefix: "contacts:",
    title: "Contacts",
    hint: "Viewing includes private notes and archived contacts. Each additional action requires View contacts.",
  },
  {
    prefix: "scheduling:",
    title: "Scheduling",
    hint: "All customer bookings. Resource creation and cancellation each require View all bookings.",
  },
  {
    prefix: "files:",
    title: "Files",
    hint: "Viewing exposes names and metadata. Each additional action requires View file names and metadata; downloads expose file contents.",
  },
  {
    prefix: "notifications:",
    title: "Notifications",
    hint: "Scheduled messages and email history across the business. Each additional action requires viewing. Processing can send due messages; acknowledgement does not resend them.",
  },
  {
    prefix: "billing:",
    title: "Billing",
    hint: "All invoices, including drafts. Each additional action requires View all invoices. Recording an external payment changes invoice status without moving money.",
  },
];
function Permissions({
  selected = [],
  disabled = false,
}: {
  selected?: readonly string[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset
      className="permission-fields permission-groups"
      disabled={disabled}
    >
      <legend>Permissions</legend>
      <p>
        Choose only the access this person needs. Grants apply across the
        business, not just records assigned to them. Selecting an action does
        not automatically grant viewing.
      </p>
      {permissionGroups.map((group) => (
        <fieldset
          className="permission-fields"
          key={group.prefix}
          aria-describedby={`${id}-${group.prefix}`}
        >
          <legend>{group.title}</legend>
          <p className="hint" id={`${id}-${group.prefix}`}>
            {group.hint}
          </p>
          {staffPermission.options
            .filter((permission) => permission.startsWith(group.prefix))
            .map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  name="permission"
                  value={permission}
                  defaultChecked={selected.includes(permission)}
                />{" "}
                {labels[permission]}
              </label>
            ))}
        </fieldset>
      ))}
    </fieldset>
  );
}
export function TeamPanel({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const team = useQuery({
    queryKey: ["admin", "team", userId],
    retry: false,
    queryFn: ({ signal }) => apiRequest("/team", { signal }, teamSchema),
  });
  const [modalError, setModalError] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [removal, setRemoval] = useState<{
    path: string;
    name: string;
    version?: number;
  } | null>(null);
  useFeedbackNotice(removal ? "" : message, failed, feedback);
  useEffect(() => {
    // Member forms remount after their version changes. Give keyboard users a
    // stable result target, but do not move focus out of an open modal.
    if (message && !pending && !removal) feedback.current?.focus();
  }, [message, pending, removal]);
  async function mutate(
    path: string,
    method: string,
    body: object | undefined,
    success: string,
  ) {
    if (pending) return false;
    setPending(true);
    setMessage("");
    setFailed(false);
    setModalError("");
    try {
      await apiRequest(
        path,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        },
        resultSchema,
      );
      await cache.invalidateQueries({ queryKey: ["admin"] });
      setMessage(success);
      return true;
    } catch (error) {
      setFailed(true);
      if (removal)
        setModalError(
          error instanceof ApiError
            ? error.message
            : "The request failed. Please try again.",
        );
      setMessage(
        error instanceof ApiError
          ? error.message
          : "The request failed. Please try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await mutate(
        "/team/invitations",
        "POST",
        { email: data.get("email"), permissions: data.getAll("permission") },
        "Invitation sent. It expires in 48 hours.",
      )
    )
      form.reset();
  }
  return (
    <section className="directory" aria-labelledby="team-title">
      <h2 id="team-title" className="sr-only">
        Team management
      </h2>
      <p className="hint">
        Invite people to help manage your business. Only the owner can manage
        team access.
      </p>
      {pending && !removal && <p role="status">Saving team changes…</p>}
      {message && !removal && (
        <p
          className={`form-feedback${failed ? " form-feedback-error" : ""}`}
          ref={feedback}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {team.isPending ? (
        <TeamSkeleton />
      ) : team.isError ? (
        <div role="alert">
          <p>The team could not be loaded. Your access may have changed.</p>
          <Button onClick={() => void team.refetch()}>Reload team</Button>
        </div>
      ) : (
        <>
          {team.data.invitationsEnabled ? (
            <form className="component-card invitation-form" onSubmit={invite}>
              <h3>Invite a team member</h3>
              <Field
                disabled={pending}
                label="Invitation email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
              />
              <Permissions disabled={pending} />
              <Button type="submit" disabled={pending}>
                Send invitation
              </Button>
            </form>
          ) : (
            <p>
              Invitations are disabled for this installation. Existing team
              access can still be managed.
            </p>
          )}
          <h3>Members</h3>
          <div className="team-list">
            {team.data.members.map((member) => (
              <section
                className="component-card"
                key={`${member.userId}-${member.version}`}
                aria-label={`Member ${member.email}`}
              >
                <h4>{member.name}</h4>
                <p className="team-email">{member.email}</p>
                {member.role === "owner" ? (
                  <p>Owner · Full access</p>
                ) : (
                  <>
                    <form
                      className="member-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void mutate(
                          `/team/members/${encodeURIComponent(member.userId)}`,
                          "PUT",
                          {
                            version: member.version,
                            permissions: new FormData(
                              event.currentTarget,
                            ).getAll("permission"),
                          },
                          "Permissions updated.",
                        );
                      }}
                    >
                      <Permissions
                        selected={member.permissions}
                        disabled={pending}
                      />
                      <Button type="submit" disabled={pending}>
                        Save permissions
                      </Button>
                    </form>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        setRemoval({
                          path: `/team/members/${encodeURIComponent(member.userId)}`,
                          name: member.email,
                          version: member.version,
                        })
                      }
                    >
                      Remove member
                    </Button>
                  </>
                )}
              </section>
            ))}
          </div>
          <h3>Pending invitations</h3>
          {team.data.invitations.length ? (
            <ul className="invitation-list">
              {team.data.invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <p>
                      Expires {new Date(invitation.expiresAt).toLocaleString()}
                    </p>
                    <p>
                      {invitation.permissions
                        .map((permission) => labels[permission])
                        .join(", ") || "No delegated permissions"}
                    </p>
                  </div>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      setRemoval({
                        path: `/team/invitations/${invitation.id}`,
                        name: invitation.email,
                      })
                    }
                  >
                    Cancel invitation
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No pending invitations.</p>
          )}
        </>
      )}
      <Dialog
        open={!!removal}
        onClose={() => {
          if (pending) return;
          setRemoval(null);
          setModalError("");
        }}
        title={removal?.version ? "Remove team member" : "Cancel invitation"}
        actions={
          <>
            {" "}
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setRemoval(null);
                setModalError("");
              }}
            >
              Close
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                if (
                  removal &&
                  (await mutate(
                    removal.path,
                    "DELETE",
                    removal.version ? { version: removal.version } : undefined,
                    removal.version
                      ? "Team access removed."
                      : "Invitation cancelled.",
                  ))
                )
                  setRemoval(null);
              }}
            >
              {pending
                ? "Processing…"
                : `Confirm ${removal?.version ? "removal" : "cancellation"}`}
            </Button>
          </>
        }
      >
        <p>
          {removal?.version
            ? "Remove team access for"
            : "Cancel the invitation for"}{" "}
          {removal?.name}?{" "}
          {removal?.version
            ? "Their customer account and data will remain."
            : "The email link will stop working."}
        </p>
        {removal && modalError && (
          <p className="form-feedback form-feedback-error" role="alert">
            {modalError}
          </p>
        )}
      </Dialog>
    </section>
  );
}
