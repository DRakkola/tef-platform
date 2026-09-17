/**
 * Application route configurations.
 */

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./HomePage";
import { NotFoundPage } from "@/components/NotFoundPage";
import { StudentDashboardPage } from "@/features/dashboard";
import { AssessmentsListPage, AssessmentRunnerPage } from "@/features/assessments";
import { ExercisePracticePage } from "@/features/exercises";

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<StudentDashboardPage />} />
        <Route path="/assessments" element={<AssessmentsListPage />} />
        <Route path="/assessments/:id" element={<AssessmentRunnerPage />} />
        <Route path="/exercises/:id" element={<ExercisePracticePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};
