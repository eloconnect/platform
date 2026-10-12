import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import PasswordRecoveryPage from "./pages/PasswordRecoveryPage";
import PasswordResetPage from "./pages/PasswordResetPage";
import RegistrationPendingPage from "./pages/RegistrationPendingPage";
import AssociatePortalLayout from "./pages/associate/AssociatePortalLayout";
import AssociateHomePage from "./pages/associate/AssociateHomePage";
import AssociateBillsPage from "./pages/associate/AssociateBillsPage";
import AssociateBenefitsPage from "./pages/associate/AssociateBenefitsPage";
import AssociateConventionsPage from "./pages/associate/AssociateConventionsPage";
import AssociateNewsPage from "./pages/associate/AssociateNewsPage";
import AssociateSupportPage from "./pages/associate/AssociateSupportPage";
import AssociateCancellationPage from "./pages/associate/AssociateCancellationPage";
import AdminPortalLayout from "./pages/admin/AdminPortalLayout";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminContentPage from "./pages/admin/AdminContentPage";
import AdminValuesPage from "./pages/admin/AdminValuesPage";
import AdminRegistrationsPage from "./pages/admin/AdminRegistrationsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegistrationPendingPage />} />
        <Route path="/recuperar-senha" element={<PasswordRecoveryPage />} />
        <Route path="/redefinir-senha" element={<PasswordResetPage />} />
        <Route path="/associado" element={<AssociatePortalLayout />}>
          <Route index element={<AssociateHomePage />} />
          <Route path="boletos" element={<AssociateBillsPage />} />
          <Route path="beneficios" element={<AssociateBenefitsPage />} />
          <Route path="convencoes" element={<AssociateConventionsPage />} />
          <Route path="noticias" element={<AssociateNewsPage />} />
          <Route path="suporte" element={<AssociateSupportPage />} />
          <Route path="cancelamento" element={<AssociateCancellationPage />} />
        </Route>
        <Route path="/admin" element={<AdminPortalLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="valores" element={<AdminValuesPage />} />
          <Route path="convencoes" element={<AdminContentPage />} />
          <Route path="cadastros" element={<AdminRegistrationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
