// Clerk sign-in page; returns the user to where they were afterwards.
export const getLoginUrl = () => {
  const here = window.location.pathname + window.location.search;
  if (here.startsWith("/sign-in") || here.startsWith("/sign-up")) return "/sign-in";
  return `/sign-in?redirect_url=${encodeURIComponent(here)}`;
};
