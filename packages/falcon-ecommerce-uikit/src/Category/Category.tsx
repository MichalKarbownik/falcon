import React from 'react';
import { NetworkStatus } from 'apollo-client';
import MediaQuery from 'react-responsive';
import { Toggle } from 'react-powerplug';
import { themed, H1, Divider, Box, FlexLayout, Button, Sidebar, Backdrop, Portal } from '@deity/falcon-ui';
import { SortOrderDropdown } from './SortOrderDropdown';
import { ShowingOutOf } from './ShowingOutOf';
import { ShowMore } from './ShowMore';
import { toGridTemplate } from '../helpers';
import { ProductsList } from '../ProductsList/ProductsList';
import { Filters, getFiltersData } from '../Filters';
import { SortOrder } from './../Search/types';

export const CategoryArea = {
  heading: 'heading',
  filters: 'filters',
  content: 'content',
  footer: 'footer'
};

export const CategoryLayout = themed({
  tag: 'div',

  defaultTheme: {
    productsCategory: {
      display: 'grid',
      gridGap: 'md',
      my: 'lg',
      // prettier-ignore
      gridTemplate: {
        xs: toGridTemplate([
          ['1fr'               ],
          [CategoryArea.heading],
          [CategoryArea.filters],
          [CategoryArea.content],
          [CategoryArea.footer ]
        ]),
        md: toGridTemplate([
          ['1fr',                   '3fr'               ],
          [CategoryArea.heading,    CategoryArea.heading],
          [CategoryArea.filters,    CategoryArea.content],
          [CategoryArea.footer,     CategoryArea.footer ]
        ]),
        lg: toGridTemplate([
          ['1fr',                   '4fr'               ],
          [CategoryArea.heading,    CategoryArea.heading],
          [CategoryArea.filters,    CategoryArea.content],
          [CategoryArea.footer,     CategoryArea.footer ]
        ])
      }
    }
  }
});

export const Category: React.SFC<{
  category: { name: string; products: any };
  availableSortOrders: SortOrder[];
  activeSortOrder: SortOrder;
  setSortOrder(order: SortOrder): null;
  fetchMore: any;
  aggregations: any;
  networkStatus: NetworkStatus;
}> = ({ category, availableSortOrders, activeSortOrder, setSortOrder, fetchMore, networkStatus }) => {
  const { products } = category;
  const { pagination, items, aggregations } = products;

  return (
    <CategoryLayout>
      <Box gridArea={CategoryArea.heading}>
        <H1>{category.name}</H1>
        <FlexLayout justifyContent="space-between" alignItems="center">
          <ShowingOutOf itemsCount={items.length} totalItems={pagination.totalItems} />
          <SortOrderDropdown
            items={availableSortOrders}
            value={activeSortOrder}
            onChange={x => setSortOrder(x as SortOrder)}
          />
        </FlexLayout>
        <Divider mt="xs" />
      </Box>
      <Box gridArea={CategoryArea.filters}>
        <MediaQuery minWidth={860}>
          {(matches: boolean) =>
            matches ? (
              <Filters data={getFiltersData(aggregations)} />
            ) : (
              <Toggle initial={false}>
                {({ on, toggle }: any) => (
                  <React.Fragment>
                    <Button onClick={toggle}>Filters</Button>
                    <Sidebar as={Portal} visible={on}>
                      <Filters data={getFiltersData(aggregations)} />
                    </Sidebar>
                    <Backdrop onClick={toggle} as={Portal} visible={on} />
                  </React.Fragment>
                )}
              </Toggle>
            )
          }
        </MediaQuery>
      </Box>
      <Box gridArea={CategoryArea.content}>
        <ProductsList products={items} />
      </Box>
      <Box gridArea={CategoryArea.footer}>
        {pagination.nextPage && <Divider />}
        {pagination.nextPage && <ShowMore onClick={fetchMore} loading={networkStatus === NetworkStatus.fetchMore} />}
      </Box>
    </CategoryLayout>
  );
};
