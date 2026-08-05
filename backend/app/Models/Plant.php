<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plant extends Model
{
    protected $table = 'plant';

    protected $primaryKey = 'id_plant';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = ['id_plant', 'nama_plant', 'created_at'];
}
