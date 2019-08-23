import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Link, Icon, DefaultThemeProps, Box } from '@deity/falcon-ui';
import { MenuQuery, CustomerQuery, CartQuery } from '@deity/falcon-shop-data';
import { MenuNavbar, toGridTemplate, OpenSidebarMutation, CartIcon } from '@deity/falcon-ui-kit';
import { Banner } from './Banner';

export const SearchBarArea = {
  logo: 'logo',
  signIn: 'signIn',
  cart: 'cart',
  search: 'search'
};

const searchBarLayoutTheme: DefaultThemeProps = {
  searchbarLayout: {
    display: 'grid',
    py: 'sm',
    gridGap: 'sm',
    // prettier-ignore
    gridTemplate: toGridTemplate([
      ['200px',            '1fr',                'auto',               'auto'            ],
      [SearchBarArea.logo, SearchBarArea.search, SearchBarArea.signIn, SearchBarArea.cart]
    ]),
    css: {
      alignItems: 'center'
    }
  }
};

export const Searchbar = () => (
  <Box defaultTheme={searchBarLayoutTheme}>
    <Link aria-label="DEITY" pl="sm" height="xxl" as={RouterLink} gridArea={SearchBarArea.logo} to="/">
      <Icon src="logo" />
    </Link>
    <OpenSidebarMutation>
      {openSidebar => (
        <React.Fragment>
          <CustomerQuery>
            {({ customer }) =>
              customer ? (
                <Link as={RouterLink} to="/account" gridArea={SearchBarArea.signIn}>
                  <Icon src="account" />
                </Link>
              ) : (
                <Link
                  gridArea={SearchBarArea.signIn}
                  onClick={() => openSidebar({ variables: { contentType: 'account' } })}
                >
                  <Icon src="signIn" />
                </Link>
              )
            }
          </CustomerQuery>
          <CartQuery>
            {({ cart }) => (
              <Link gridArea={SearchBarArea.cart} onClick={() => openSidebar({ variables: { contentType: 'cart' } })}>
                <CartIcon itemsQty={cart && cart.itemsQty} />
              </Link>
            )}
          </CartQuery>
        </React.Fragment>
      )}
    </OpenSidebarMutation>
  </Box>
);

export const Header: React.SFC = () => (
  <header>
    <Banner />
    <Searchbar />
    <nav>
      <MenuQuery>{({ menu }) => <MenuNavbar items={menu} />}</MenuQuery>
    </nav>
  </header>
);
