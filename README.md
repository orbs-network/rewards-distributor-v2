# Rewards Distributor V2
> Orbs PoS V2 release

&nbsp;

## Sub Projects

* `./shared` - TypeScript shared code with all core logic for rewards calcs used by the other projects
* `./rewards-ui` - web-based UI for manual distribution and analysis of rewards
* `./rewards-service` - node.js service for a validator node that distibutes rewards automatically

&nbsp;

## Project: shared

TypeScript shared code with all core logic for rewards calcs used by the other projects

### Install dev environment

* Prerequisites:

  * Node.js (version > 8.1) 
  * npm (version > 5.2)

* Install project:

  ```
  cd shared
  npm install
  ```

* Run unit tests:

  ```
  npm test
  ```

* Run end-to-end tests (on ganache):

  ```
  npm run start-ganache
  npm run test:e2e
  npm run stop-ganache
  ```

### Build and deploy

* Compile shared library:

  ```
  npm run build
  ```

### Calculation algorithm overview

See [ALGORITHM.md](shared/ALGORITHM.md).

&nbsp;

## Project: rewards-ui

Web-based UI for manual distribution and analysis of rewards

### Install dev environment

* Prerequisites:

  * Node.js (version > 8.1) 
  * npm (version > 5.2)
  * Install and build shared lib:

    ```
    cd shared
    npm install
    npm run build
    cd ..
    ```

* Install project:

  ```
  cd rewards-ui
  npm install
  ```

* Run tests:

  ```
  npm test
  ```

* Run a local development server:

  ```
  npm start
  ```

### Build and deploy

* Bundle files for production:

  ```
  npm run build
  ```

&nbsp;

## Project: rewards-service