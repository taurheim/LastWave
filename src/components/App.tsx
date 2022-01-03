import React from 'react';
import { Route, Routes } from 'react-router-dom';
import LastFmDataSource from 'services/LastFmDataSource';
import './App.css';
import Header from './Header';

export default function App() {
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  const end = new Date();
  const data = new LastFmDataSource('Taurheim');

  const run = async () => {
    const snapshots = await data.getDataForTimePeriod({ start, end }, 'week');
    console.log(snapshots);
  };

  return (
    <Routes>
      <Route path="/" element={<Header title="A" subtitle="B" />}>
        <Route
          index
          element={
            <div>
              <button type="button" onClick={run}>
                Click me
              </button>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
