const fetch = globalThis.fetch.bind(globalThis);
export default fetch;
export const Response = globalThis.Response;
export const Request = globalThis.Request;
export const Headers = globalThis.Headers;
export const FetchError = Error;
