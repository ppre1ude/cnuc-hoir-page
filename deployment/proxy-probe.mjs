import assert from "node:assert/strict";

const expected = process.argv[2] === "first" ? [401, 401, 401, 401, 401, 429] : [401];
const proxyUrl = "http://proxy/api/v1/auth";
const csrfResponse = await fetch(`${proxyUrl}/csrf`, {
  headers: { "X-Forwarded-For": "not-an-ip" },
});
assert.equal(csrfResponse.status, 200);
const { token } = await csrfResponse.json();
const cookie = csrfResponse.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
assert.ok(cookie);

const results = [];
for (let index = 0; index < expected.length; index += 1) {
  const response = await fetch(`${proxyUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
      "X-CSRF-TOKEN": token,
      "X-Forwarded-For": "not-an-ip",
    },
    body: JSON.stringify({
      email: `${process.argv[2]}-${index}@example.invalid`,
      password: "invalid-password",
    }),
  });
  results.push(response.status);
}
assert.deepEqual(results, expected);
console.log(`${process.argv[2] === "first" ? "첫 번째" : "두 번째"} 클라이언트: ${results.join(", ")}`);
