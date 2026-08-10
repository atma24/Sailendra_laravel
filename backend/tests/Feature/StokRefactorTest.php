<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Concerns\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Tests\TestCase;

class StokRefactorTest extends TestCase
{
    private function controller(): object
    {
        return new class {
            use ApiResponse {
                requireLok as public;
            }
        };
    }

    public function test_require_lok_returns_lokasi_when_present(): void
    {
        $request = Request::create('/api/deep', 'GET', ['id_pengguna_lokasi' => 'LOC1']);

        $result = $this->controller()->requireLok($request);

        $this->assertSame('LOC1', $result);
    }

    public function test_require_lok_fails_when_empty(): void
    {
        $request = Request::create('/api/deep', 'GET');

        $result = $this->controller()->requireLok($request);

        $this->assertInstanceOf(JsonResponse::class, $result);
        $this->assertSame(400, $result->getStatusCode());
        $this->assertSame('id_pengguna_lokasi wajib', $result->getData(true)['message']);
    }
}