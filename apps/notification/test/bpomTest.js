/* eslint-disable no-undef */
const chai = require('chai')
const bpomApiWorker = require('../src/bpom-api.worker')
const expect = chai.expect

chai.should()

const headers = { Unit: '02', Token: '9f240b7abcdbf7fec807c0f09faf528ddbab9bb5' }
const BPOMURL = 'http://103.116.204.248/vaksin-dev/api'

// const testPayload = {
//   type: 'distribution', 
//   vendor: saranaData, 
//   customer: saranaData, 
//   orders: [

//   ],
// }

const testPayload = {
  type: 'distribution',
  vendor: {
    url: BPOMURL+'/integration/sendSarana',
    data: {
      key_sarana: '27',
      kode_sarana: '32',
      kelompok_sarana: '2',
      name: 'DINKES PROV. JAWA BARAT',
      alamat: '-',
      city: null,
      province: '3200',
      kode_pos: null,
      pic: '',
      email: '',
      no_tlp: '',
      no_izin: null,
      tgl_izin: null,
      nib: null,
      npwp: null,
      lat: '-6.9542777',
      long: '107.590112',
      no_sertifikat: null,
      tgl_sertifikat: null
    },
    headers: headers,
    method: 'POST',
    checkUrl: BPOMURL+'/integration/dataSarana',
    checkParameter: {
      key_sarana: 'all',
      kelompok_sarana: '2',
      province: '3200',
      city: null
    }
  },
  customer: {
    url: BPOMURL+'/integration/sendSarana',
    data: {
      key_sarana: null,
      kode_sarana: '3216',
      kelompok_sarana: '4',
      name: 'DINKES KAB. BEKASI',
      alamat: '-',
      city: '3216',
      province: '3200',
      kode_pos: null,
      pic: '',
      email: '',
      no_tlp: '',
      no_izin: null,
      tgl_izin: null,
      nib: null,
      npwp: null,
      lat: '-6.29729355445786',
      long: '107.026421639538',
      no_sertifikat: null,
      tgl_sertifikat: null
    },
    headers: headers,
    method: 'POST',
    checkUrl: BPOMURL+'/integration/dataSarana',
    checkParameter: {
      key_sarana: 'all',
      kelompok_sarana: '4',
      province: '3200',
      city: '3216'
    }
  },
  orders: [
    {
      url: BPOMURL+'/integration/distribute',
      data: {
        'jenis': '1',
        'tgl_distribusi': '2021-04-28T04:53:22.000Z',
        'kode': null, // material code
        'jumlah': 10, // order item received_qty
        'batch': '',
        'tgl_expired': '',
        'nomor_faktur': null,
        'tujuan': '3216',
        'pelapor': '32',
        'alamat': '-',
        'lat': '-6.29729355445786',
        'long': '107.026421639538',
        'keterangan': {}
      },
      headers: headers,
      method: 'POST'
    },
    {
      url: BPOMURL+'/integration/distribute',
      data: {
        'jenis': '1',
        'tgl_distribusi': '2021-04-28T04:53:22.000Z',
        'kode': '35774', // material code
        'jumlah': 10, // order item received_qty
        'batch': '24000521',
        'tgl_expired': '2021-07-23T00:00:00.000Z',
        'nomor_faktur': null,
        'tujuan': '3216',
        'pelapor': '32',
        'alamat': '-',
        'lat': '-6.29729355445786',
        'long': '107.026421639538',
        'keterangan': {}
      },
      headers: headers,
      method: 'POST'
    }
  ]
}

describe('BPOM test', () => {
  it('test order', async () => {
    var order = await bpomApiWorker.processOrder(testPayload)
    expect(order).to.equal(true)
  })
})