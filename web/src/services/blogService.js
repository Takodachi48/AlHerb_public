import { blogService } from '../../../shared/services/blogService';
import api from './api';

export const blogApi = blogService(api);

export default blogApi;
