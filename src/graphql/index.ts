import { createYoga, createSchema } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { buildContext } from './context';
import { Query } from './resolvers/Query';
import { Mutation } from './resolvers/Mutation';
import { Todo } from './resolvers/Todo';
import { User } from './resolvers/User';

const typeDefs = readFileSync(import.meta.dir + '/schema.graphql', 'utf-8');

export const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers: { Query, Mutation, Todo, User },
  }),
  context: buildContext,
  graphqlEndpoint: '/graphql',
});
