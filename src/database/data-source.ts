import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Vote } from '../modules/votes/entities/vote.entity';
import { Voter } from '../modules/users/entities/user.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { Nominee } from '../modules/nominees/entities/nominee.entity';
import { Media } from '../modules/media/entities/media.entity';

const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const sslOptions = sslEnabled
  ? {
      ca: process.env.DB_SSL_CA || undefined,
      rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'false').toLowerCase() !== 'false',
    }
  : false;

const baseOptions: DataSourceOptions = {
  type: 'postgres',
  entities: [Voter, Vote, Category, Nominee, Media],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  logging: false,
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'gca_db',
  ssl: sslOptions,
};

export const AppDataSource = new DataSource(baseOptions);
export default baseOptions;
