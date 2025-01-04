import dayjs from 'dayjs';
import { PrismaClient } from '@prisma/client';

export const formatDate = (date: Date | string = new Date(), format = 'MM/DD/YYYY HH:mm:ss') => dayjs(date).format(format);

export const prisma = new PrismaClient();
