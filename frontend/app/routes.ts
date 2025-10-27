import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("agentic-research", "routes/agentic-research.tsx"),
  route("discover", "routes/discover.tsx"),
  route("my-researchers", "routes/my-researchers.tsx"),
] satisfies RouteConfig;
