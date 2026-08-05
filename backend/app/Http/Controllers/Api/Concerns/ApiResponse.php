<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

trait ApiResponse
{
    protected function ok(Collection|array $data = [], string $message = ''): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ]);
    }

    protected function okMessage(string $message, array $data = []): JsonResponse
    {
        return $this->ok($data, $message);
    }

    protected function fail(string $message, int $code = 400): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'data' => null,
        ], $code);
    }

    protected function isSupervisor(array $in): bool
    {
        $role = (string) ($in['role'] ?? 'Checker');

        return $role === 'Supervisor' || $role === 'SuperAdmin';
    }
}
