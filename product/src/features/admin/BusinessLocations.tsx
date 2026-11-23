import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useConfirmation } from "@/components/ui/useConfirmation";
import type { Business } from "../../../shared/business";

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
type Location = Business["locations"][number];
const week = [1, 2, 3, 4, 5, 6, 0];
function weeklySummary(hours: Location["hours"]) {
  const groups: { first: number; last: number; times: string }[] = [];
  for (const day of week) {
    const times =
      hours
        .filter((period) => period.day === day)
        .sort((a, b) => a.opens.localeCompare(b.opens))
        .map((period) => (period.opens || "…") + "–" + (period.closes || "…"))
        .join(", ") || "Closed";
    const previous = groups.at(-1);
    if (previous?.times === times) previous.last = day;
    else groups.push({ first: day, last: day, times });
  }
  return groups;
}
export function BusinessLocations({
  locations,
  editingId,
  onEdit,
  timezone,
  errors,
  disabled,
  onChange,
}: {
  editingId: string | null;
  onEdit: (id: string | null) => void;
  locations: Location[];
  timezone: string;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (locations: Location[]) => void;
}) {
  const confirmation = useConfirmation();
  function addLocation() {
    const id = crypto.randomUUID();
    onChange([...locations, { id, name: "", address: "", hours: [] }]);
    onEdit(id);
    requestAnimationFrame(() =>
      document.getElementById("location-" + id)?.focus(),
    );
  }
  return (
    <>
      <header className="location-heading">
        <div>
          <h2>Locations and opening hours</h2>
          <p className="hint">
            Weekly hours use the business timezone ({timezone}).
          </p>
        </div>
        <Button
          disabled={disabled || locations.length >= 30}
          onClick={addLocation}
        >
          Add location
        </Button>
      </header>
      {!locations.length && (
        <div className="portal-empty">
          No locations added yet. Add an office, shop or other business address.
        </div>
      )}
      {locations.map((location, index) => {
        const editing = editingId === location.id;
        const prefix = "locations." + index;
        const change = (patch: Partial<Location>) =>
          onChange(
            locations.map((item) =>
              item.id === location.id ? { ...item, ...patch } : item,
            ),
          );
        const hours = location.hours;
        const monday = hours.filter((h) => h.day === 1);
        const copied = [
          ...hours.filter((h) => h.day === 0 || h.day === 6 || h.day === 1),
          ...[2, 3, 4, 5].flatMap((day) => monday.map((h) => ({ ...h, day }))),
        ];
        return (
          <fieldset
            key={location.id}
            className="location-card"
            disabled={disabled}
          >
            <legend className="sr-only">
              {location.name || "New location"}
            </legend>
            <header className="location-heading">
              <div>
                <h3>{location.name || "New location"}</h3>
                {!editing && location.address && (
                  <p className="hint">{location.address}</p>
                )}
              </div>
              <div className="location-controls">
                <Button
                  variant="secondary"
                  aria-expanded={editing}
                  aria-controls={"edit-" + location.id}
                  onClick={() => onEdit(editing ? null : location.id)}
                >
                  {editing ? "Show summary" : "Edit location"}
                </Button>
                {editing && (
                  <button
                    type="button"
                    className="location-action"
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
                        onChange(
                          locations.filter((item) => item.id !== location.id),
                        );
                    }}
                  >
                    Remove location
                  </button>
                )}
              </div>
            </header>
            {!editing && (
              <dl className="location-summary">
                {weeklySummary(hours).map(({ first, last, times }) => (
                  <div key={first}>
                    <dt>
                      {first === last
                        ? days[first]
                        : days[first] + "–" + days[last]}
                    </dt>
                    <dd>{times}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div id={"edit-" + location.id} hidden={!editing}>
              {editing && (
                <>
                  <div className="business-fields business-profile-fields">
                    <Field
                      id={"location-" + location.id}
                      label="Location name"
                      required
                      maxLength={100}
                      value={location.name}
                      error={errors[prefix + ".name"]}
                      onChange={(e) => change({ name: e.target.value })}
                    />
                    <Field
                      label="Address"
                      maxLength={160}
                      value={location.address}
                      error={errors[prefix + ".address"]}
                      onChange={(e) => change({ address: e.target.value })}
                    />
                  </div>
                  <div className="location-heading week-heading">
                    <h4>Weekly hours</h4>
                    {!!monday.length && (
                      <button
                        type="button"
                        className="location-action"
                        disabled={copied.length > 21}
                        onClick={async () => {
                          if (
                            hours.some((h) => h.day >= 2 && h.day <= 5) &&
                            !(await confirmation.confirm(
                              "Replace Tuesday through Friday with Monday’s opening periods?",
                              {
                                title: "Copy weekday hours?",
                                confirmLabel: "Replace hours",
                              },
                            ))
                          )
                            return;
                          change({ hours: copied });
                        }}
                      >
                        Copy Monday to Tue–Fri
                      </button>
                    )}
                  </div>
                  {week.map((day) => {
                    const periods = hours
                      .map((period, i) => ({ period, i }))
                      .filter(({ period }) => period.day === day);
                    return (
                      <div
                        role="group"
                        aria-label={days[day]}
                        className="location-day"
                        key={day}
                      >
                        <strong>{days[day]}</strong>
                        <div>
                          {!periods.length && (
                            <span className="hint">Closed</span>
                          )}
                          {periods.map(({ period, i }, n) => (
                            <div className="location-period" key={i}>
                              {(["opens", "closes"] as const).map((k) => (
                                <Field
                                  key={k}
                                  id={location.id + "-" + i + "-" + k}
                                  type="time"
                                  label={k === "opens" ? "Opens" : "Closes"}
                                  required
                                  value={period[k]}
                                  error={
                                    errors[prefix + ".hours." + i + "." + k]
                                  }
                                  onChange={(e) =>
                                    change({
                                      hours: hours.map((h, j) =>
                                        j === i
                                          ? { ...h, [k]: e.target.value }
                                          : h,
                                      ),
                                    })
                                  }
                                />
                              ))}
                              <button
                                type="button"
                                className="location-action"
                                aria-label={`Remove ${days[day]} period ${n + 1}`}
                                onClick={() =>
                                  change({
                                    hours: hours.filter((_, j) => j !== i),
                                  })
                                }
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="location-action"
                          disabled={hours.length >= 21}
                          onClick={() => {
                            change({
                              hours: [
                                ...hours,
                                {
                                  day,
                                  opens: periods.length ? "" : "09:00",
                                  closes: periods.length ? "" : "17:00",
                                },
                              ],
                            });
                            requestAnimationFrame(() =>
                              document
                                .getElementById(
                                  location.id + "-" + hours.length + "-opens",
                                )
                                ?.focus(),
                            );
                          }}
                        >
                          {periods.length ? "Add period" : "Set hours"}
                        </button>
                      </div>
                    );
                  })}
                  <p className="hint">
                    For overnight hours, enter a period on each day.
                  </p>
                </>
              )}
            </div>
          </fieldset>
        );
      })}
    </>
  );
}
