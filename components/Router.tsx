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

export function useParams(): Record<string, string | undefined> {
  const { pathname } = useLocation();
  
  // Robust Regex for extracting IDs
  // Matches /watch/123-abc, /watch/123-abc/, but not /watch
  const watchMatch = pathname.match(/\/watch\/([^/?&]+)/);
  if (watchMatch) {
    return { id: watchMatch[1] };
  }

  const channelMatch = pathname.match(/\/channel\/([^/?&]+)/);
  if (channelMatch) {
    return { userId: channelMatch[1] };
  }

  // Add regex for Marketplace items (excluding 'create' route)
  const marketMatch = pathname.match(/\/marketplace\/([^/?&]+)/);
  if (marketMatch && marketMatch[1] !== 'create' && marketMatch[1] !== 'cart') {
    return { id: marketMatch[1] };
  }

  return {};
}

export const Link: React.FC<{ to: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>> = ({ to, children, className, ...props }) => {
  return (
    <a href={`#${to}`} className={className} {...props}>
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
           // Simple prefix matching for :id params, works for now
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