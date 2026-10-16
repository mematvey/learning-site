import { getRoadmaps } from './data';
import type { PageLoad } from './$types';

export const load: PageLoad = () => ({ roadmaps: getRoadmaps() });
