import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-8">
            <div className="relative">
                <div className="text-[150px] font-black text-slate-800 leading-none select-none">404</div>
                <AlertTriangle className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-orange-500" size={64} />
            </div>

            <h1 className="text-2xl font-bold text-white mt-4 mb-2">Không tìm thấy trang</h1>
            <p className="text-slate-400 max-w-md mb-8">
                Trang bạn đang tìm kiếm không tồn tại hoặc bạn không có quyền truy cập.
            </p>

            <Link
                to="/"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-colors"
            >
                <Home size={20} />
                Về Trang Chủ
            </Link>
        </div>
    );
}
