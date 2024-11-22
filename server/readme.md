
## Instruction to run the application local

- Step 1: create a `.env` file at root of the directory and include the environment variables as following bellow

  ```bash
    NODE_ENV=dev
    PORT=5000
    DATABASE_URL=
    JWT_SECRET=your_jwt_secret
  ```

- Step 2: install all the dependencies using the command
  ```bash
    npm install 
    #or 
    yarn
    #or
    pnpm instal
  ```
- Step 3: run the development server using the command

  ```bash
    npm run dev
  ```

  or run the production server using the commands

  ```bash
    # at first build the production server
    npm run build

    #then
    npm start
  ```
