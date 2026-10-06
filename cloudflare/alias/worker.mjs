export default {
  async fetch(request, env) {
    return env.FOUNDING_APP.fetch(request);
  },
};
