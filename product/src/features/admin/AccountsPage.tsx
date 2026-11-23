"use client";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingTable } from "@/components/ui/LoadingContent";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { usersPageSchema } from "../../../shared/access";
export function AccountsPage() {
  const cache = useQueryClient();
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["admin", "users"] });
    },
    [cache],
  );
  return (
    <OwnerPage title="Accounts" permission="users:read">
      {(userId) => <Users userId={userId} />}
    </OwnerPage>
  );
}

function Users({ userId }: { userId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const users = useQuery({
    queryKey: ["admin", "users", userId, search, page],
    retry: false,
    queryFn: ({ signal }) =>
      apiRequest(
        `/admin/users?${new URLSearchParams({ search, page: String(page) })}`,
        { signal },
        usersPageSchema,
      ),
  });
  return (
    <section className="directory">
      <h2 className="sr-only">Account directory</h2>
      <p className="hint">
        Registered customers and team members. Team access is assigned
        separately.
      </p>
      <form
        className="directory-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(
            String(
              new FormData(event.currentTarget).get("search") ?? "",
            ).trim(),
          );
          setPage(1);
        }}
      >
        <Field
          label="Search accounts"
          name="search"
          type="search"
          maxLength={100}
          placeholder="Name or email"
        />
        <Button type="submit">Search</Button>
      </form>
      {users.isPending ? (
        <LoadingTable
          label="Loading accounts…"
          columns={["Name", "Email", "Email status", "Team access"]}
          pagination
          count
        />
      ) : users.isError ? (
        <div role="alert">
          <p>Accounts could not be loaded. Your access may have changed.</p>
          <Button onClick={() => void users.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <p className="list-result-summary" role="status">
            {users.data.total} account{users.data.total === 1 ? "" : "s"}
            {search ? ` matching “${search}”` : ""}
          </p>
          {users.data.items.length ? (
            <div
              className="table-scroll"
              role="region"
              aria-label="Account directory"
              tabIndex={0}
            >
              <table className="data-table">
                <caption className="sr-only">Registered accounts</caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Email status</th>
                    <th scope="col">Team access</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.items.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">{user.name}</th>
                      <td>{user.email}</td>
                      <td>{user.emailVerified ? "Verified" : "Unverified"}</td>
                      <td>
                        {user.teamRole === "owner"
                          ? "Owner"
                          : user.teamRole === "staff"
                            ? "Team member"
                            : "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No accounts found. Try another search.</p>
          )}
          <Pagination
            label="Account pages"
            page={page}
            pageSize={users.data.pageSize}
            total={users.data.total}
            disabled={users.isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
