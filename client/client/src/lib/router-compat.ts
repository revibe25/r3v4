// router-compat.ts — ONE canonical routing import for the entire client
// All routing primitives must be imported from here, never from wouter directly
// and NEVER from react-router-dom.
//
// Root cause fixed: login.tsx imported Link from react-router-dom while the
// app uses wouter. react-router-dom's Link calls useContext(RouterContext);
// without a BrowserRouter ancestor useContext returns null and destructuring
// 'basename' throws TypeError at render time.

export {
  Link,
  Route,
  Switch,
  Redirect,
  Router,
  useLocation,
  useRoute,
  useRouter,
} from "wouter";
