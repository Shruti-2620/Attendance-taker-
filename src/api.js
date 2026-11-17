// Each browser gets a random id, so people only ever see their own subjects.
function ownerId() {
  let id = localStorage.getItem("leaving-owner");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("leaving-owner", id);
  }
  return id;
}

async function call(path, options = {}) {
  const headers = { "X-Owner-Id": ownerId(), ...(options.headers || {}) };
  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = body.detail;
    throw new Error(typeof d === "string" ? d : d?.[0]?.msg?.replace("Value error, ", "") || "Something went wrong");
  }
  return body;
}

const json = (method, data) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  dashboard: () => call("/dashboard"),
  add: (s) => call("/subjects", json("POST", s)),
  update: (id, s) => call(`/subjects/${id}`, json("PUT", s)),
  mark: (id, attended) => call(`/subjects/${id}/mark?attended=${attended}`, { method: "POST" }),
  remove: (id) => call(`/subjects/${id}`, { method: "DELETE" }),
  parseTimetable: (file) => {
    const form = new FormData();
    form.append("file", file);
    return call("/parse-timetable", { method: "POST", body: form });
  },
};
