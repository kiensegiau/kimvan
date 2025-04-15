import React from 'react';
import Link from 'next/link';

export default function KhoaHoc() {
  // Dữ liệu bảng khóa học
  const khoaHocData = [
    {
      stt: '0',
      ngayHoc: '23/12/2024',
      tenBai: 'Khai Giảng 2k8 - XPS IMOE 2025',
      live: '/api/spreadsheets/QD3nU2uI047DjsbKVicmy1MbGbRM-10_HGXU_YzD0yi62TIaHL2W7mlF7AVKM4Ad0PGbhBwJXz0/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/nYbfTPzLOKS8wzw2JICdXg3WYpGWt6l2lMx4AzQgcD973Qwa3ma0eH_VymrZG-eWuuNkfAoNvpsK32SpU1yM7RwAOXavDT4A-uFgRD9yvfzNJwlwHrsmoUXSw1QNC8mqBlAlU0VRY_Bg0MtjLw/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '-',
      thiOnline: '',
      chuaTest: '',
      banVietTay: '-'
    },
    {
      stt: '1',
      ngayHoc: '25/12/2024',
      tenBai: 'Bài 0101: Cấu trúc của chất',
      live: '/api/spreadsheets/aWCW01oXbDdysV2mmMLt1rRVU_IbkvVAUleijSLjcIVUo8yR7VwM10KMcvMkD0zPA6XDMNr-KAs/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/UzC0eWldQn1PnsLYD75Yd3levq6fP3TWkHKH9mkcn65OACh_5qos4Zz1iQqpc9CVcBukMLjriBgVHYc9GJTz13OrtlHCynq78Bik6_VpAaZjS-mDuaz742G8RwprYWC_EKwgHIwIqWCtuYZ3WA/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '/api/spreadsheets/3lgsApDTTw8IhaDLMs9kJ3dp-YkNXcCixC_4ZHLHmK0TqJ1POptC4TLn8quvj8DCq1c11kGM_EgB-be-uLWMpFBOn2wwMNhG7-bVjsBRLWCyIDwqHPPBR6JwGUgOUGDUOBGxR37Hzspt92_aKA/BTVN/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '/api/spreadsheets/dpjs2txhTOAtj-AA3yXVaUnGexP0SkOOA-mVyM0lZDOgJALROG0R3bGiHRZRae6MFMv9JQNnSZLbQPOVMSlzU1IeFatEVlJZDmIG98DLJHTF9M7VSXdwVeUhtZwSqulac1Pdf_SBYtfgOk1O3g/TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      chuaTest: '',
      banVietTay: '-'
    },
    {
      stt: '2',
      ngayHoc: '04/1/2024',
      tenBai: 'Chữa bài tập 0101 - Cấu trúc của chất',
      live: '/api/spreadsheets/tRRGu8lmGu-F0dPVVvwZOGvezbC70fL2zGLDgM0tLX8BzvDQTNmes1DHDMgdK0ZNB_FbWDHHDHo/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '-',
      btvn: '-',
      thiOnline: '',
      chuaTest: '',
      banVietTay: '-'
    },
    {
      stt: '3',
      ngayHoc: '08/1/2024',
      tenBai: '0102 - Sự liên kết phân tử',
      live: '/api/spreadsheets/Yt5u8cGdPLgGQ141Kxq1hV51ggiUGFwesql2_WShTeCkX8U7GW13N-dWdH80H7uzHAKLgDjkkbo/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/aamfoeLbv35Cvk2y4xomrrvn1vsYyV0-tQzu4-BoIvB1kyGhe5L0wTlen7OZ0lUpL1IsTFBTPjbZIDRdJEL2wTSB5TxMOWRBn49Lzf81fgGf1on6_jQOY5Gj6N0wQ2KfC9yMH69B7kYfB0l4H8COM43SJA/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '/api/spreadsheets/K7qe_1oLToucCIeK4TBwfdEBt_DyHZIQYc6_KdAT9tyzrDeOkdN5ceLiqgvYXovx_CcPYR8NkZrQ4a3WreUksUp03-6rN9BTLDMuEsWD4kyy4DUaAt28CKyio685xJIHmLb15PyRzgTtNajqog/BTVN/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '/api/spreadsheets/jCmTTke7A5fkROOJEqIOPYtgl2vn4PSys5Dk9Yqwt5wp4BdZVz9Ob61OwTif4K9XMOSoGmkkejMfYnwxl_4LhU9yDcjULBmG4455WTEhz2thJVfTR1ESERP8LppVzdyp-aEMTjJt95NJXaslHw/TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      chuaTest: '/api/spreadsheets/umF4fczxLzLZ1DNkgsxyHyqZqS2_rS0GTsOqpjLlfxOyyt8lhVj9ozgNIB0dijXIvf_pg2YD95Q/CHỮA TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      banVietTay: '/api/spreadsheets/lblWByfThhh9uwC_cN6HHgHtsWTHSlPYhBrK2hGA_qbLw6DQULZ0BJj0xH6n8bgxbPBCSDXD6dKZ8xXp1pOmcD8eYN_GVgaOCvXoeDyqrcGbwH7pSOcQpwgPzME6BcVKW58tJ957Wpj3ndqnM0MKTi-kIg/Bản viết tay/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect'
    },
    {
      stt: '-',
      ngayHoc: '-',
      tenBai: 'Chữa BTVN 0102',
      live: '',
      taiLieu: '',
      btvn: '/api/spreadsheets/KWMKJkWs5cig-rEGjariejIx-DrlNAsXlG-HFnr8qBHXdKlCWOLlYJW34tGb7DgKV6J2gLvWiGM/BÀI GIẢNG/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '',
      chuaTest: '',
      banVietTay: ''
    },
    {
      stt: '4',
      ngayHoc: '15/1/2024',
      tenBai: '0103 - Sự chuyển thể của chất',
      live: '/api/spreadsheets/7sOnYAymXAiGgKMCoNRAkXoab3UIhDGPkzSkc9rQrJgDN6QMuoqHOxKw5tDIU4mBYrBILp90waU/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/kBIZpjdhzRvcelR4XH6nuoLt-rJbo1Ple5BZg3ExGhktLsnCKNe9lLtVM67WAoQk0O-x5MK3D2gi1VmVfKtDdAXRfIULEkIvQTBJUQ2ZdZFLB9RCc7r2n_N4LQCx9Qe8jfnmFXzGwxdy_pyFWA/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '/api/spreadsheets/50UQrRrXo5qzKrXPyOz6jOeePTkTFHgB7qyx29oG1qQX4mQ021n1GwcJ8kOFQRAiS3cerP7ru2tLk6nQf9EixwN06O2MEqmYWAgNj-ySDWNB_ubSgLRHLI5yA0JTRnOfQZwzouQnvQGWBSCorA/BTVN/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '/api/spreadsheets/wQQ7EPOR6qZGTIfLdq7Fo_UjtMmRY2KbbRmuwLKSIsynkdcm8X4V1KAA5nbpJSjBiyiBmOf8kSh7_fAJEBbSE93mR92ox1jAfHlagAqkCZQDp92Ar7vaocMHbdwqlYnjI6QwbXcxMnkQbiNGNw/TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      chuaTest: '',
      banVietTay: '-'
    },
    {
      stt: '5',
      ngayHoc: '05/2/2025',
      tenBai: '0104 - Nhiệt độ, nhiệt kế - Thang nhiệt độ',
      live: '/api/spreadsheets/yASSKTrW6zZWm0FXOyLDgz96EAkjL8xSq5oFufhI-aaWRoQxE7kUnFGuTwaCuloBhiWQB2mOhAY/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/uwFEAnmWY6oehVEnbnLG0RYP3ZI4lvISWm3u8-MRH_Zxq6sgJyQ_-Qm6D6xtsaZbfADy0kaePyAkbxJLcXfg-_1TH8S3OVV4SM6TJ27arXrXL4i8Sr5C86PRjHikUJfUU0VKNzUoexfK1bJdfg/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '/api/spreadsheets/RTBIy4XtRM8Hqa5s0GEQq4GEEAdPg1nDUqIsb95l57Bx9fjUgbwKgTuWar6rBEuGL-I8kE8nOgkhpQOz-zNXL5G8zi96aPGWWumytZdtAljjTZWQ4nsHFYhxDdjOcTlbf9603Lo5B6tJMz9zBQ/BTVN/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '/api/spreadsheets/X3W5gRM4vAdxTd6wrJRiF0Q6skIs5iUH1DNxFrKr2Cx8PjhNDOAvcCo3xPXzDLicpJhv775FAvZRz3_gC-AEShok_hLvsZjfiTUrSYxHFTb8YZD8fmBbR4lA4weG_Vpfi0Ol50gBmi5VAx3zjw/TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      chuaTest: '/api/spreadsheets/E999xO5udZJ1IiovLKBBSdkH27I77jSiyRLTnF4olECOtSNaYu4LhS_gIlwsVFJAqTAZ5LhZOPs/CHỮA TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      banVietTay: '-'
    },
    {
      stt: '6',
      ngayHoc: '12/2/2025',
      tenBai: 'Chữa bài tập 0103: Sự chuyển thể',
      live: '',
      taiLieu: '-',
      btvn: '/api/spreadsheets/B0SHuydKUgy5kQ-anwzbktb6G1rNwjldTGeFCGdWPmDGjTje4jwetb3ztoiLkFprgQiG331ycPo/BÀI GIẢNG/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '',
      chuaTest: '',
      banVietTay: '-'
    },
    {
      stt: '-',
      ngayHoc: '-',
      tenBai: 'Chữa BTVN 0104',
      live: '/api/spreadsheets/y8xAaMEiTPgqmTH-866Z-NgrPNIjMqTQrqeSQA9DM8KkJA5QcddySqoqSFzcHF0sQ6yMNMxnsucD-mD9JOVcDi05aya2uyt71XOnYc_TBjoXlUrWso5Cirre4ORx_4YeKIvE_Q/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '',
      btvn: '',
      thiOnline: '',
      chuaTest: '',
      banVietTay: ''
    },
    {
      stt: '7',
      ngayHoc: '19/2/2025',
      tenBai: '0105 - Nội Năng - Định Luật 1 Nhiệt Động Lực Học',
      live: '/api/spreadsheets/YQdY2qy2Q864iSt-LpMx0UJ3i95G-KD5xAtAkMzs6uxW4AFQqTjE5SKg2sX_YfU5qnFkX76EGV8/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/Wb_3-8Js6jXMHGD1fcG4-XnPeknbVoXt5_CqI-OiY9LDlYrWM61OG_bMNVxvaZz5a54x6IRPyqEiF84HukThKfGoVQ-KkaDhThhvCSCRpF8wScQ54K7_fY7PH_xYI_7y10kw0YcI7jk_pHWz_A/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '/api/spreadsheets/sDJuOG4v_svixGacSgcvMrFVttBG4eSbv75W1jwen3RFZQdYqLhnGD1ZrduC_zku_wKdY7fRQQdJN3B514iouPmnqN1wZhv7UaCuCqtFd2yMiIdCFz0j08L3kTt-ztpsNGRfuu-9MwjbZPjz9w/BTVN/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '/api/spreadsheets/EWFyGxZxzGXyOumQ2bgBXY0auAboJSNxcCkMWng37CkW9gj_-TT46-m7UbmlzLgZqpQVE5lkJqOtY456XV6hvbbmJaZVK5uC15hGpCXlDXmvj1OK9DLB4lYqE_x_HQ4tKAnFRLecPkzChMH0Dg/TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      chuaTest: '/api/spreadsheets/olqGsqEuSOHKt_HRmm-gYkBM-LynYPW3Aeh7EvoBydzo8dlANHr32iNfKaMLcFtea7v3ONYU3dQ/CHỮA TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      banVietTay: '/api/spreadsheets/JUEBkvOjcR5QuXMowBdds-uSxE6qsHyWU4qhdLkR8hsqxwVomcbi39aSSgyqdM3LYpGcWpNYdKtqXUK21JbEnxujL1bVYxjO00YpOl-x645-9JK1s9ZSmCsI6YJehvhJWo1E_NQdhq0u2Hz-Kg/Bản viết tay/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect'
    },
    {
      stt: '-',
      ngayHoc: '-',
      tenBai: 'Chữa BTVN 0105',
      live: '',
      taiLieu: '',
      btvn: '/api/spreadsheets/ke2O1Lxzl9G-8WsH3MqMZbdwZdB471Dm3NEJUdonEEbWF7GXBwNvWvsVkNpVtAKvFECIinnsFeU/BÀI GIẢNG/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '',
      chuaTest: '',
      banVietTay: ''
    },
    {
      stt: '8',
      ngayHoc: '26/2/2025',
      tenBai: 'Luyện tập - 0105 - Nội năng và định luật 1 nhiệt động lực học',
      live: '/api/spreadsheets/RY-cPGQlhWXtmnTbKAiLPXQG3r0JTTILbwXxYLcHi4NebYv-h6DHrSclArNIRLJ1hTSTvlNuVDA/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/SQZqCWbB4MGRO0tOEhVYNoTxABkc5bfmtsDi3aFNLTuLje459-yw4XRGVRYEuMvSGAdd67jB09Bwo2kEBo_zFcgXopx10lYrMITgcrUsnOSX8VZ5PKcUruAK5uPXyyELIFfhfOtopuQt5wIFag/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '-',
      thiOnline: '',
      chuaTest: '',
      banVietTay: '/api/spreadsheets/qUaTud52KVJ_upay3n0LgrGrlwl3Vee3qsuUiO5Akri3ILbn_t6-kRGTZCjZAhzTU2kYlHNgalo9Okgdupdhzz0hQSpjsMR1OZkQk2SHUFgYgDDh1gvsH-IttXLR50zCmUveXKnTFYmE-zFUdQ/Bản viết tay/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect'
    },
    {
      stt: '9',
      ngayHoc: '05/3/2025',
      tenBai: '0106 - Nhiệt dung riêng',
      live: '/api/spreadsheets/9a5qeH95RRzW0T9I49MMYy8KGQHoI6RpXrOiiVPP1SAXmu3X6isi74g_zinVgp4jcAj8Y8ca7Us/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/dLmAMAJeW5CIiLTfaPlPMok2lrHVLpbuj2U8Zhqc-Mrq3BG1mIAGI0TmV1gIGAEq9uVDj4YGNOOHz5xWkkj9LrHITIb5kEneG2xbJpwQXJfroGsc2o6ShvFMDXoVBXOHxu3HqAEiaGvIH_8n6Q/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '/api/spreadsheets/Jtfkc0vPFO55OW3s_diveXkb0-9HsM14d_NmNaqAsjY0vixLaWernMH9Xg8ohOlxsNgmj7Eg3-c/BÀI GIẢNG/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      thiOnline: '/api/spreadsheets/BQbN0zhGfkZESzWtSh7tRK_zx4zwIqM8d3tSbvr8p8PI4VVhjPSYMw_2Lk153G-xVy6oj4No-IipVijYLROPt9pa-KOpax03mvMCnBJ37OUPwXAc6Oinq_8EgFc6yo0BCVCmm1cZQNiSrK2mwx0/TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      chuaTest: '/api/spreadsheets/YwAWFVq64badfBDoFqqCFRuZ3nhB5H4tVa-aqGLdBwIUMeQ-3tRUa8y8dSorXQSdnbMb3mLpC30/CHỮA TEST/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      banVietTay: ''
    },
    {
      stt: '10',
      ngayHoc: '15/3/2025',
      tenBai: 'Nâng cao đồ thị trao đổi nhiệt',
      live: '/api/spreadsheets/if4syBbmrUVQY1PZCPQjHDVgeejpwS56Qu_tkgpcNLCV2NapgMnFoUl_3ry5d8DiKlhyWFGrOc0/LIVE/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      taiLieu: '/api/spreadsheets/vZPcGfw104jqtxqTX385RO5nGIBmQUknvw3Bp34YBAaouF-GtscfXDeKx-CzrgucOJLopP41KRWV7kf_n-RVRilHnPg6y--BVC8I07Yhikmr8CVJPYf-av0hTrSYTEzYcWfGEjxNH_H-Og8S3A/TÀI LIỆU/KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025/redirect',
      btvn: '',
      thiOnline: '',
      chuaTest: '',
      banVietTay: ''
    }
  ];

  // Dữ liệu còn lại từ bài 11-16 có thể được thêm vào đây

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025
          </h1>
          <Link href="/" className="text-blue-500 hover:underline">
            ← Trở về trang chủ
          </Link>
        </div>
        
        <div className="overflow-x-auto rounded-lg shadow">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-blue-50 text-blue-700">
                <th className="py-3 px-4 text-center font-bold border">STT</th>
                <th className="py-3 px-4 text-center font-bold border">NGÀY HỌC</th>
                <th className="py-3 px-4 text-center font-bold border">TÊN BÀI</th>
                <th className="py-3 px-4 text-center font-bold border">LIVE</th>
                <th className="py-3 px-4 text-center font-bold border">TÀI LIỆU</th>
                <th className="py-3 px-4 text-center font-bold border">BTVN</th>
                <th className="py-3 px-4 text-center font-bold border">THI ONLINE</th>
                <th className="py-3 px-4 text-center font-bold border">CHỮA TEST</th>
                <th className="py-3 px-4 text-center font-bold border">BẢN VIẾT TAY</th>
              </tr>
            </thead>
            <tbody>
              {/* Dòng tiêu đề chương */}
              <tr className="bg-cyan-500 text-white font-bold">
                <td className="py-2 px-4 border text-center">✅</td>
                <td className="py-2 px-4 border text-center">📋</td>
                <td className="py-2 px-4 border text-center" colSpan="7">CHƯƠNG 1: VẬT LÝ NHIỆT</td>
              </tr>

              {/* Các dòng dữ liệu */}
              {khoaHocData.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-4 border text-center text-blue-600 font-bold">{item.stt}</td>
                  <td className="py-2 px-4 border text-center text-red-600 font-bold">{item.ngayHoc}</td>
                  <td className="py-2 px-4 border text-left text-red-600 font-bold">{item.tenBai}</td>
                  <td className="py-2 px-4 border text-center">
                    {item.live ? (
                      <a 
                        href={item.live} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        LIVE
                      </a>
                    ) : ''}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {item.taiLieu && item.taiLieu !== '-' ? (
                      <a 
                        href={item.taiLieu} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        TÀI LIỆU
                      </a>
                    ) : (item.taiLieu || '')}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {item.btvn && item.btvn !== '-' ? (
                      <a 
                        href={item.btvn} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
                      >
                        BTVN
                      </a>
                    ) : (item.btvn || '')}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {item.thiOnline ? (
                      <a 
                        href={item.thiOnline} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                      >
                        TEST
                      </a>
                    ) : ''}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {item.chuaTest ? (
                      <a 
                        href={item.chuaTest} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        CHỮA TEST
                      </a>
                    ) : ''}
                  </td>
                  <td className="py-2 px-4 border text-center">
                    {item.banVietTay && item.banVietTay !== '-' ? (
                      <a 
                        href={item.banVietTay} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                      >
                        BẢN VIẾT TAY
                      </a>
                    ) : (item.banVietTay || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 