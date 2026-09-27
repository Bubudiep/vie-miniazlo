import { getSystemInfo } from "zmp-sdk";
import {
  AnimationRoutes,
  App,
  Route,
  SnackbarProvider,
  ZMPRouter,
} from "zmp-ui";
import { AppProps } from "zmp-ui/app";

import HomePage from "@/pages/index";
import TabBar from "./taskbar";
import AccountPage from "@/pages/account";
import PlayingPage from "@/pages/playing";
import TablesPage from "@/pages/tables";

const Layout = () => {
  return (
    <App theme={getSystemInfo().zaloTheme as AppProps["theme"]}>
      <SnackbarProvider>
        <ZMPRouter>
          <AnimationRoutes>
            <Route path="/" element={<TablesPage />}></Route>
            <Route path="/home" element={<HomePage />}></Route>
            <Route path="/account" element={<AccountPage />}></Route>
            <Route path="/:tableId" element={<PlayingPage />}></Route>
          </AnimationRoutes>
          <TabBar />
        </ZMPRouter>
      </SnackbarProvider>
    </App>
  );
};
export default Layout;
