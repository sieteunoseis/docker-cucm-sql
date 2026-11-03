/** Who is calling, from Authelia's forward-auth headers. Display/logging only — never trusted for access. */
export function identityFrom(headers) {
    for (const key of ["remote-user", "remote-name", "remote-email"]) {
        const v = headers[key];
        const value = Array.isArray(v) ? v[0] : v;
        if (value?.trim())
            return value.trim();
    }
    return "anonymous";
}
//# sourceMappingURL=identity.js.map