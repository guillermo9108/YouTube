
import React, { createContext, useContext, useEffect, useState } from 'react';

const RouterContext = createContext<{ pathname: string }>({ pathname: '/' });
const OutletContext = createContext<React.ReactNode>(null);

export function useLocation() {
  return useContext(RouterContext);
}

export function useNavigate() {
  return (to: string, options?: { replace?: boolean }) => {
    window.location.hash = to;
  };
}

export function useParams() {
  const { pathname } = useLocation();
  // Fixed Regex to be more robust for URLs like /watch/ID?param=1
  const match = pathname.match(/\/watch\/([^/?&]+)/);
  return match ? { id: match[1] } : {};
}

export const Link: React.FC<{ to: string; children?: React.ReactNode; className?: string }> = ({ to, children, className }) => {
  return (
    <a href={`#${to}`} className={className}>
      {children}
    </a>
  );
};

export function Outlet() {
  return useContext(OutletContext);
}

export function Navigate({ to }: { to: string; replace?: boolean }) {
  useEffect(() => {
    window.location.hash = to;
  }, [to]);
  return null;
}

export function HashRouter({ children }: { children?: React.ReactNode }) {
  const [pathname, setPathname] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handler = () => {
      let p = window.location.hash.slice(1);
      if (!p) p = '/';
      setPathname(p);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return (
    <RouterContext.Provider value={{ pathname }}>
      {children}
    </RouterContext.Provider>
  );
}

interface RouteProps {
  path?: string;
  element?: React.ReactNode;
  children?: React.ReactNode;
}

export function Routes({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const routes = React.Children.toArray(children) as React.ReactElement<RouteProps>[];

  for (const route of routes) {
    const { path, element, children: nested } = route.props;

    if (!path && nested) {
      const childRoutes = React.Children.toArray(nested) as React.ReactElement<RouteProps>[];
      for (const child of childRoutes) {
        const cp = child.props.path;
        let isMatch = false;

        if (cp === '*') isMatch = true;
        else if (cp === pathname) isMatch = true;
        else if (cp && cp.includes(':')) {
           const prefix = cp.split(':')[0];
           if (pathname.startsWith(prefix)) isMatch = true;
        }

        if (isMatch) {
          return (
            <OutletContext.Provider value={child.props.element}>
              {element}
            </OutletContext.Provider>
          );
        }
      }
    } else {
      let isMatch = false;
      if (path === '*') isMatch = true;
      else if (path === pathname) isMatch = true;
      else if (path && path.includes(':')) {
           const prefix = path.split(':')[0];
           if (pathname.startsWith(prefix)) isMatch = true;
      }

      if (isMatch) return element;
    }
  }
  return null;
}

export function Route(props: RouteProps) {
  return null;
}
