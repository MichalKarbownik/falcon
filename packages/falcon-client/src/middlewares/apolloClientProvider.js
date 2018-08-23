import { ApolloLink } from 'apollo-link';
import ApolloClient from '@hostSrc/service/ApolloClient';
import { clientState } from '@hostSrc/clientApp';
import configuration from '@hostSrc/clientApp/configuration';

/**
 * Apollo Client Provider middleware.
 * sets ApolloClinet on ctx.state.client
 * @async
 * @param {string} ctx - Koa context.
 * @param {string} next - Koa next.
 * @returns {Promise<void>} - next middleware
 */
export default async (ctx, next) => {
  const { serverTiming } = ctx.state;

  const profileMiddleware = new ApolloLink((operation, forward) => {
    let name = operation.operationName;
    try {
      if (!name) {
        name = operation.query.definitions[0].selectionSet.selections
          .map(item => (item.kind === 'Field' ? item.name.value : ''))
          .join(', ');
      }
    } catch (e) {
      name = '<unknown>';
    }

    const qTimer = serverTiming.start(`> ${operation.query.definitions[0].operation}: ${name}`);
    return forward(operation).map(result => {
      serverTiming.stop(qTimer);
      return result;
    });
  });

  const client = new ApolloClient({
    clientState: {
      defaults: {
        ...configuration.configState.defaults,
        ...clientState.defaults
      },
      resolvers: { ...clientState.resolvers }
    },
    extraLinks: [profileMiddleware]
  });

  ctx.state.client = client;

  return next();
};