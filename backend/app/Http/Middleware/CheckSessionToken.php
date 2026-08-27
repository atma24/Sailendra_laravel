<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CheckSessionToken
{
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $sessionToken = $request->header('X-Session-Token');
        if (!$sessionToken || $sessionToken !== $user->session_token) {
            return response()->json(['success' => false, 'message' => 'Session expired, login again'], 401);
        }

        return $next($request);
    }
}