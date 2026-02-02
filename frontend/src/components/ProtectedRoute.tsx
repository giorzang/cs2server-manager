import { useAuthStore } from '../store/useAuthStore';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

/**
 * Route guard component that protects pages:
 * - Default: requires logged-in user
 * - With requireAdmin: requires admin user
 * 
 * Redirects to Steam login if unauthorized
 */
export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { user, isLoading } = useAuthStore();

    const redirectToLogin = () => {
        window.location.href = '/auth/steam';
        return null;
    };

    // Still loading auth state - show nothing to prevent flash
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center text-slate-500">
                Đang kiểm tra quyền truy cập...
            </div>
        );
    }

    // Not logged in -> redirect to login
    if (!user) {
        return redirectToLogin();
    }

    // Requires admin but user is not admin -> redirect to login
    if (requireAdmin && user.is_admin !== 1) {
        return redirectToLogin();
    }

    // Authorized - render the protected content
    return <>{children}</>;
}
