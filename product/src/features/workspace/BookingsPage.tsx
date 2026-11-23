"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { LoadingTable } from "@/components/ui/LoadingContent";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { apiRequest, ApiError } from "@/api/client";
import { resourcesSchema, bookingsSchema } from "../../../shared/scheduling";

export function SchedulingPage() {
  return (
    <OwnerPage title="Scheduling" permission="scheduling:read">
      {(userId, permissions) => (
        <>
          {permissions.includes("scheduling:resources") && (
            <Resources userId={userId} />
          )}
          <Bookings
            key={permissions.join(",")}
            admin
            canCancel={permissions.includes("scheduling:cancel")}
          />
        </>
      )}
    </OwnerPage>
  );
}
export function BookingsPage() {
  return (
    <>
      <h1>My bookings</h1>
      <Bookings />
    </>
  );
}
function Resources({ userId }: { userId: string }) {
  const [id, setId] = useState(() => crypto.randomUUID());
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const cache = useQueryClient();
  return (
    <form
      className="component-card"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const form = event.currentTarget;
        const fields = new FormData(form);
        setPending(true);
        setOperation("Creating resource…");
        setError("");
        const days = fields.getAll("day").map(Number);
        if (!days.length) {
          setOperation("");
          setError("Select at least one open day.");
          setPending(false);
          return;
        }
        try {
          await apiRequest("/scheduling/resources", {
            method: "POST",
            body: JSON.stringify({
              id,
              data: {
                name: fields.get("name"),
                timezone: fields.get("timezone"),
                hours: days.map((day) => ({
                  day,
                  opens: fields.get("opens"),
                  closes: fields.get("closes"),
                })),
              },
            }),
          });
          setId(crypto.randomUUID());
          form.reset();
          setOperation("Resource created.");
          await cache.invalidateQueries({
            queryKey: ["bookings", "resources"],
          });
        } catch (failure) {
          setOperation("");
          setError(
            failure instanceof ApiError
              ? failure.message
              : "Could not create the resource.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Create a resource</h2>
      <p>
        Each resource accepts one booking at a time. Opening hours use its
        timezone. Set a room, person, or piece of equipment; no business
        category is assumed.
      </p>
      <fieldset className="settings-fields form-columns" disabled={pending}>
        <legend>Resource availability</legend>
        <Field label="Resource name" name="name" required maxLength={120} />
        <Field
          label="Resource timezone"
          name="timezone"
          defaultValue="UTC"
          required
        />
        <Field
          label="Opens"
          name="opens"
          type="time"
          required
          defaultValue="09:00"
        />
        <Field
          label="Closes"
          name="closes"
          type="time"
          required
          defaultValue="17:00"
        />
        <fieldset className="resource-days">
          <legend>Open days</legend>
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((day, index) => (
            <label className="permission-option" key={`${userId}-${day}`}>
              <input
                type="checkbox"
                name="day"
                value={index}
                defaultChecked={index > 0 && index < 6}
              />
              {day}
            </label>
          ))}
        </fieldset>
      </fieldset>
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={operation} focus={false} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create resource"}
      </Button>
    </form>
  );
}
function Bookings({
  admin = false,
  canCancel = true,
}: {
  admin?: boolean;
  canCancel?: boolean;
}) {
  const confirmation = useConfirmation();
  const cache = useQueryClient();
  const [resourceId, setResourceId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [id, setId] = useState(() => crypto.randomUUID());
  const [operation, setOperation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const resources = useQuery({
    queryKey: ["bookings", "resources"],
    queryFn: ({ signal }) =>
      apiRequest("/scheduling/resources", { signal }, resourcesSchema),
    retry: false,
  });
  const list = useQuery({
    queryKey: ["bookings", admin],
    queryFn: ({ signal }) =>
      apiRequest(
        `/scheduling/bookings${admin ? "?scope=all" : ""}`,
        { signal },
        bookingsSchema,
      ),
    retry: false,
    staleTime: 0,
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["bookings"] });
    },
    [cache],
  );
  const selected = resources.data?.items.find(
    (resource) => resource.id === resourceId,
  );
  return (
    <>
      <h2>{admin ? "Latest 100 bookings" : "Reserve a time"}</h2>
      <p>
        {admin ? (
          "Review bookings across the business. Available actions depend on your permissions."
        ) : (
          <>
            Enter times in your device timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}). Book 15 minutes
            to 8 hours, up to 180 days ahead. Availability is checked when you
            submit.
          </>
        )}
      </p>
      {!admin && (
        <form
          className="component-card"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            setOperation("reserve");
            setError("");
            setMessage("");
            try {
              await apiRequest("/scheduling/bookings", {
                method: "POST",
                body: JSON.stringify({
                  id,
                  resourceId,
                  startsAt: new Date(start).toISOString(),
                  endsAt: new Date(end).toISOString(),
                }),
              });
              setId(crypto.randomUUID());
              setStart("");
              setEnd("");
              setMessage("Booking confirmed.");
              await list.refetch();
            } catch (failure) {
              setError(
                failure instanceof ApiError
                  ? failure.message
                  : "Could not book that time. Check your dates and try again.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset className="settings-fields" disabled={pending}>
            <legend>Reservation</legend>
            <SelectField
              label="Resource"
              required
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            >
              <option value="">Choose a resource</option>
              {resources.data?.items.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.data.name}
                </option>
              ))}
            </SelectField>
            {resources.isError && (
              <p role="alert">
                Resources could not be loaded. Sign in and reload this page.
              </p>
            )}
            {selected && (
              <p>
                Resource timezone: {selected.data.timezone}. Open:{" "}
                {selected.data.hours
                  .map(
                    (period) =>
                      `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][period.day]} ${period.opens}–${period.closes}`,
                  )
                  .join("; ")}
              </p>
            )}
            <Field
              label="Starts"
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Field
              label="Ends"
              type="datetime-local"
              required
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </fieldset>
          <Button type="submit" disabled={pending}>
            {pending && operation === "reserve" ? "Reserving…" : "Reserve time"}
          </Button>
        </form>
      )}
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={message} focus={false} />
      {list.isPending ? (
        <LoadingTable
          label="Loading bookings…"
          columns={["Resource", "Time", "Status", "Actions"]}
        />
      ) : list.isError ? (
        <>
          <p role="alert">
            Bookings could not be loaded. Sign in or try again.
          </p>
          <Button onClick={() => void list.refetch()}>Refresh bookings</Button>
        </>
      ) : (
        <DataTable
          caption={admin ? "Business bookings" : "My bookings"}
          rows={list.data.items}
          rowKey={(row) => row.id}
          empty="No bookings yet."
          columns={[
            {
              key: "resource",
              label: "Resource",
              render: (row) => row.resourceName,
            },
            {
              key: "time",
              label: "Time",
              render: (row) =>
                `${new Date(row.startsAt).toLocaleString()} – ${new Date(row.endsAt).toLocaleString()}`,
            },
            { key: "status", label: "Status", render: (row) => row.status },
            {
              key: "cancel",
              label: "Actions",
              render: (row) =>
                row.status === "confirmed" && canCancel ? (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={async () => {
                      if (
                        !(await confirmation.confirm("Cancel this booking?", {
                          title: "Cancel booking?",
                          confirmLabel: "Cancel booking",
                        }))
                      )
                        return;
                      setPending(true);
                      setOperation(row.id);
                      setMessage("");
                      setError("");
                      try {
                        await apiRequest(
                          `/scheduling/bookings/${row.id}/cancel`,
                          { method: "POST" },
                        );
                        await list.refetch();
                        setMessage("Booking cancelled.");
                      } catch {
                        setError("Could not cancel this booking.");
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    {pending && operation === row.id
                      ? "Cancelling…"
                      : "Cancel booking"}
                  </Button>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      )}
    </>
  );
}
