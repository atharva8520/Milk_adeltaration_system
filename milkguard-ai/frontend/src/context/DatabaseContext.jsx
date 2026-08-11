import React, { createContext, useContext, useState } from 'react';

const DatabaseContext = createContext();

export function DatabaseProvider({ children }) {
  // Mock unified state for modules without backend integration yet
  const [db, setDb] = useState({
    livestock: [],
    govCertificates: [],
    logistics: [],
    fraudAlerts: []
  });

  const addLivestock = (animal) => setDb(prev => ({...prev, livestock: [...prev.livestock, animal]}));
  const addGovCert = (cert) => setDb(prev => ({...prev, govCertificates: [...prev.govCertificates, cert]}));
  const addFraudAlert = (alert) => setDb(prev => ({...prev, fraudAlerts: [...prev.fraudAlerts, alert]}));

  return (
    <DatabaseContext.Provider value={{ db, addLivestock, addGovCert, addFraudAlert }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DatabaseContext);
}
