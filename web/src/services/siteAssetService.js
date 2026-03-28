import api from './api';

const siteAssetService = {
  async getLandingAssets() {
    return api.get('/site-assets/landing');
  },

  async getLandingAssetsAdmin() {
    return api.get('/admin/site-assets/landing');
  },

  async saveLandingAssets(payload) {
    return api.put('/admin/site-assets/landing', payload);
  },
};

export default siteAssetService;
