<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        $role = $user?->role;

        if (! $user || ! in_array($role, $roles, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Hak akses ditolak',
                'data' => null,
            ], 403);
        }

        return $next($request);
    }
}
