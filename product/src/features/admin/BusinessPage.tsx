"use client";
import { useFeedbackNotice } from "@/components/ui/useFeedbackNotice";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { emptyBusiness } from "./businessSettingsData";
import { useConfirmation } from "@/components/ui/useConfirmation";
import {
  BusinessProfileFields,
  BusinessInvoicePreferences,
  BusinessSectionNav,
} from "./BusinessSettingsFields";
import { BusinessSkeleton } from "./AdminSkeletons";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { UnsavedChanges } from "@/components/ui/UnsavedChanges";
import { apiRequest, ApiError } from "@/api/client";
import {
  businessInput,
  businessSchema,
  type Business,
} from "../../../shared/business";

export function BusinessPage() {
  return (
    <OwnerPage title="Business settings">
      {(userId) => <Settings userId={userId} />}
    </OwnerPage>
  );
}
function Settings({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ["owner", "business", userId],
    queryFn: ({ signal }) =>
      apiRequest("/business", { signal }, businessSchema),
    retry: false,
  });
  return query.isPending ? (
    <BusinessSkeleton />
  ) : query.isError ? (
    <>
      <p role="alert">Settings could not be loaded.</p>
      <Button onClick={() => void query.refetch()}>Try again</Button>
    </>
  ) : (
    <Editor key={userId} initial={query.data} />
  );
}
const defaults = emptyBusiness;
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function Editor({
  initial,
}: {
  initial: { data: Business | null; version: number };
}) {
  const confirmation = useConfirmation();
  const cache = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const [section, setSection] = useState("profile");
  const [logoLoading, setLogoLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [base, setBase] = useState(initial);
  const [draft, setDraft] = useState(initial.data ?? defaults);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  useFeedbackNotice(message);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(base.data ?? defaults);
  function update<K extends keyof Business>(key: K, value: Business[K]) {
    setFieldErrors({});
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  }
  async function reload() {
    if (
      !(await confirmation.confirm(
        "Discard your draft and load the latest settings?",
        { title: "Reload settings?", confirmLabel: "Discard and reload" },
      ))
    )
      return;
    setPending(true);
    try {
      const latest = await apiRequest("/business", {}, businessSchema);
      setBase(latest);
      setDraft(latest.data ?? defaults);
      setFieldErrors({});
      setConflict(false);
      setError("");
    } catch {
      setError("Could not load the latest settings. Your draft is still here.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <UnsavedChanges dirty={dirty} pending={pending || logoLoading} />
      <BusinessSectionNav section={section} onChange={setSection} />
      <form
        className="business-settings-form"
        ref={form}
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || logoLoading || conflict) return;
          const parsed = businessInput.safeParse(draft);
          if (!parsed.success) {
            const errors: Record<string, string> = {};
            for (const issue of parsed.error.issues) {
              let path = issue.path.join(".");
              // Cross-field hours errors belong to an editable time control.
              if (/\.hours$/.test(path)) path += ".0.opens";
              if (/\.hours\.\d+$/.test(path)) path += ".closes";
              errors[path] ??= issue.message;
            }
            const first = Object.keys(errors)[0] ?? "name";
            const invalidSection = first.startsWith("locations")
              ? "locations"
              : first.startsWith("invoiceDefaults")
                ? "invoices"
                : ["timezone", "currency", "locale"].includes(first)
                  ? "regional"
                  : "profile";
            setSection(invalidSection);
            setFieldErrors(errors);
            setError("Check the highlighted fields before saving.");
            requestAnimationFrame(() =>
              form.current
                ?.querySelector<HTMLElement>(
                  `#business-panel-${invalidSection} [aria-invalid="true"]`,
                )
                ?.focus(),
            );
            return;
          }
          setFieldErrors({});
          setPending(true);
          setError("");
          setMessage("");
          try {
            const saved = await apiRequest(
              "/business",
              {
                method: "PUT",
                body: JSON.stringify({
                  data: parsed.data,
                  version: base.version,
                }),
              },
              businessSchema,
            );
            setBase(saved);
            setDraft(saved.data!);
            setMessage("Business settings saved.");
            void cache.invalidateQueries({ queryKey: ["owner", "business"] });
            void cache.invalidateQueries({ queryKey: ["billing"] });
          } catch (failure) {
            if (
              failure instanceof ApiError &&
              [401, 403].includes(failure.status)
            )
              void cache.invalidateQueries({ queryKey: ["owner", "access"] });
            setConflict(failure instanceof ApiError && failure.status === 409);
            setError(
              failure instanceof ApiError
                ? failure.message
                : "Could not save settings. Your draft is still here.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <div id="business-panel-profile" hidden={section !== "profile"}>
          <BusinessProfileFields
            draft={draft}
            update={update}
            errors={fieldErrors}
            disabled={pending}
            onLogoLoading={setLogoLoading}
          />
        </div>
        <div id="business-panel-invoices" hidden={section !== "invoices"}>
          <BusinessInvoicePreferences
            draft={draft}
            update={update}
            errors={fieldErrors}
            disabled={pending}
          />
        </div>
        <section
          className="business-section"
          aria-labelledby="business-regional"
          id="business-panel-regional"
          hidden={section !== "regional"}
        >
          <h2 id="business-regional">Regional preferences</h2>
          <fieldset
            disabled={pending}
            className="business-fields business-regional-fields"
            aria-labelledby="business-regional"
          >
            <Field
              label="Timezone"
              required
              list="business-timezones"
              error={fieldErrors.timezone}
              value={draft.timezone}
              onChange={(e) => update("timezone", e.target.value)}
            />
            <datalist id="business-timezones">
              <option value="UTC" />
              {Intl.supportedValuesOf("timeZone").map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
            <SelectField
              label="Currency"
              error={fieldErrors.currency}
              value={draft.currency}
              onChange={(e) => update("currency", e.target.value)}
            >
              {Intl.supportedValuesOf("currency").map((code) => (
                <option key={code}>{code}</option>
              ))}
            </SelectField>
            <Field
              label="Locale"
              required
              placeholder="For example en-GB"
              error={fieldErrors.locale}
              value={draft.locale}
              onChange={(e) => update("locale", e.target.value)}
            />
          </fieldset>
          <p className="hint">
            Used as business preferences; changing them does not convert
            existing amounts or reschedule existing bookings.
          </p>
        </section>
        <section
          className="business-section"
          aria-labelledby="business-locations"
          id="business-panel-locations"
          hidden={section !== "locations"}
        >
          <h2 id="business-locations">Locations and opening hours</h2>
          <p className="hint">
            No periods means closed. Times use the business timezone. Split
            overnight hours into separate days.
          </p>
          {!draft.locations.length && (
            <p className="hint">
              No locations added yet. Add a location if your business needs
              opening hours.
            </p>
          )}
          {draft.locations.map((location, index) => {
            const change = (value: Partial<typeof location>) =>
              update(
                "locations",
                draft.locations.map((item) =>
                  item.id === location.id ? { ...item, ...value } : item,
                ),
              );
            return (
              <fieldset
                className="business-location"
                key={location.id}
                disabled={pending}
              >
                <legend>Location {index + 1}</legend>
                <Field
                  label="Location name"
                  required
                  maxLength={100}
                  error={fieldErrors[`locations.${index}.name`]}
                  value={location.name}
                  onChange={(e) => change({ name: e.target.value })}
                />
                <Field
                  label="Address"
                  maxLength={160}
                  error={fieldErrors[`locations.${index}.address`]}
                  value={location.address}
                  onChange={(e) => change({ address: e.target.value })}
                />
                {location.hours.map((period, i) => (
                  <div className="settings-hours" key={i}>
                    <SelectField
                      label="Day"
                      error={fieldErrors[`locations.${index}.hours.${i}.day`]}
                      value={period.day}
                      onChange={(e) =>
                        change({
                          hours: location.hours.map((h, n) =>
                            n === i ? { ...h, day: Number(e.target.value) } : h,
                          ),
                        })
                      }
                    >
                      {days.map((day, n) => (
                        <option key={day} value={n}>
                          {day}
                        </option>
                      ))}
                    </SelectField>
                    <Field
                      label="Opens"
                      type="time"
                      required
                      error={fieldErrors[`locations.${index}.hours.${i}.opens`]}
                      value={period.opens}
                      onChange={(e) =>
                        change({
                          hours: location.hours.map((h, n) =>
                            n === i ? { ...h, opens: e.target.value } : h,
                          ),
                        })
                      }
                    />
                    <Field
                      label="Closes"
                      type="time"
                      required
                      error={
                        fieldErrors[`locations.${index}.hours.${i}.closes`]
                      }
                      value={period.closes}
                      onChange={(e) =>
                        change({
                          hours: location.hours.map((h, n) =>
                            n === i ? { ...h, closes: e.target.value } : h,
                          ),
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        change({
                          hours: location.hours.filter((_, n) => n !== i),
                        })
                      }
                    >
                      Remove period {i + 1}
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  disabled={location.hours.length >= 21}
                  onClick={() =>
                    change({
                      hours: [
                        ...location.hours,
                        { day: 1, opens: "09:00", closes: "17:00" },
                      ],
                    })
                  }
                >
                  Add opening period
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    if (
                      await confirmation.confirm(
                        `Remove ${location.name || "this location"} and its opening hours?`,
                        {
                          title: "Remove location?",
                          confirmLabel: "Remove location",
                        },
                      )
                    )
                      update(
                        "locations",
                        draft.locations.filter(
                          (item) => item.id !== location.id,
                        ),
                      );
                  }}
                >
                  Remove location
                </Button>
              </fieldset>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            disabled={pending || draft.locations.length >= 30}
            onClick={() =>
              update("locations", [
                ...draft.locations,
                { id: crypto.randomUUID(), name: "", address: "", hours: [] },
              ])
            }
          >
            Add location
          </Button>
        </section>
        <div className="business-save">
          <div>
            <p className="hint" role="status" aria-atomic="true">
              {pending
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : base.data
                    ? "All changes saved"
                    : "No unsaved changes"}
            </p>
            <FormFeedback message={error} error focus={false} />
          </div>
          <div className="business-save-actions">
            {conflict && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void reload()}
              >
                Load latest settings
              </Button>
            )}
            <Button
              type="submit"
              disabled={pending || logoLoading || conflict || !dirty}
            >
              {pending ? "Saving…" : "Save business settings"}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
