/**
 * Application route configurations.
 */

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "@/components/NotFoundPage";
import { StudentDashboardPage } from "@/features/dashboard";

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
