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
import Menu from "@/pages/menu";

const Layout = () => {
  return (
    <App theme={getSystemInfo().zaloTheme as AppProps["theme"]}>
      <SnackbarProvider>
        <ZMPRouter>
          <AnimationRoutes>
            <Route path="/" element={<HomePage />}></Route>
            <Route path="/account" element={<AccountPage />}></Route>
            <Route path="/menu" element={<Menu />}></Route>
          </AnimationRoutes>
          <TabBar />
        </ZMPRouter>
      </SnackbarProvider>
    </App>
  );
};
export default Layout;
