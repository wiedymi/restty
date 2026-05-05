import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  isRouteErrorResponse,
  RouterProvider,
  useRouteError,
} from "react-router";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import "./styles.css";

function RouteError() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : "Unexpected error";

  return (
    <main className="home-shell">
      <section className="playground-panel error-panel">
        <div className="panel-header">
          <p className="panel-title">restty</p>
          <p className="panel-subtitle">
            Route failed with status {status}: {message}
          </p>
        </div>
      </section>
    </main>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => ({
      Component: (await import("./routes/home")).default,
    }),
    errorElement: <RouteError />,
  },
  {
    path: "/docs",
    lazy: async () => ({
      Component: (await import("./routes/docs")).default,
    }),
    errorElement: <RouteError />,
  },
  {
    path: "/docs/*",
    lazy: async () => ({
      Component: (await import("./routes/docs")).default,
    }),
    errorElement: <RouteError />,
  },
]);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
      <RouterProvider router={router} />
    </RootProvider>
  </StrictMode>,
);
