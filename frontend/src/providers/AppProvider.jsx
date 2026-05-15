import { createContext, useContext, useState } from "react";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [campaigns, setCampaigns] = useState([]);
  const [user, setUser] = useState(null);
  const [userContributions, setUserContributions] = useState([]);
  const [userCampaigns, setUserCampaigns] = useState([]);

  return (
    <AppContext.Provider
      value={{
        campaigns,
        setCampaigns,
        user,
        setUser,
        userContributions,
        setUserContributions,
        userCampaigns,
        setUserCampaigns,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
