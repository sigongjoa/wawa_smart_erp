import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useReportStore } from '../../stores/reportStore';

interface ProtectedRouteProps {
    children: ReactNode;
    adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
    const { currentUser } = useReportStore();
    const location = useLocation();

    if (!currentUser) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    if (adminOnly && !currentUser.teacher.isAdmin) {
        // If user is not admin and tries to access admin-only route, redirect to home/timer
        return <Navigate to="/timer" replace />;
    }

    return <>{children}</>;
}
