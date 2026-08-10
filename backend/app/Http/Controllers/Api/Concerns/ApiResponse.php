<?php

namespace App\Http\Controllers\Api\Concerns;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

trait ApiResponse
{
    protected function ok(Collection|array|null $data = [], string $message = ''): JsonResponse
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

    protected function requireLok(Request $request): string|JsonResponse
    {
        $idPenggunaLokasi = trim((string) $request->input('id_pengguna_lokasi', ''));

        if ($idPenggunaLokasi === '') {
            return $this->fail('id_pengguna_lokasi wajib');
        }

        return $idPenggunaLokasi;
    }
}
