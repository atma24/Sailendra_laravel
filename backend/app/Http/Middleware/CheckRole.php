<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        // Pastikan user membawa token dan valid
        if (!$request->user()) {
            return response()->json([
                'success' => false,
                'sukses' => false,
                'message' => 'Unauthorized. Sesi habis atau token tidak valid.',
                'pesan' => 'Unauthorized. Sesi habis atau token tidak valid.'
            ], 401);
        }

        // Cek apakah role user ada di dalam array $roles yang diizinkan di route
        if (!empty($roles) && !in_array($request->user()->role, $roles)) {
            return response()->json([
                'success' => false,
                'sukses' => false,
                'message' => 'Forbidden. Anda tidak memiliki akses ke fitur ini.',
                'pesan' => 'Forbidden. Anda tidak memiliki akses ke fitur ini.'
            ], 403);
        }

        return $next($request);
    }
}