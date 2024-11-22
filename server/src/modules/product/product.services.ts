/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Types } from 'mongoose';
import sortAndPaginatePipeline from '../../lib/sortAndPaginate.pipeline';
import BaseServices from '../baseServices';
import Product from './product.model';
import matchStagePipeline from './product.aggregation.pipeline';
import CustomError from '../../errors/customError';
import Purchase from '../purchase/purchase.model';
import Seller from '../seller/seller.model';
import { IProduct } from './product.interface';

class ProductServices extends BaseServices<any> {
  constructor(model: any, modelName: string) {
    super(model, modelName);
  }

  /**
   * Create new product
   */
  async create(payload: IProduct, userId: string) {
    type str = keyof IProduct;

    // Remove empty fields from payload
    (Object.keys(payload) as str[]).forEach((key: str) => {
      if (payload[key] === '') {
        delete payload[key];
      }
    });

    // Validate required fields
    if (!payload.name || !payload.price || !payload.seller) {
      throw new CustomError(400, 'Missing required fields: name, price, or seller');
    }

    payload.user = new Types.ObjectId(userId);
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Validate Seller existence
      const seller = await Seller.findById(payload.seller);
      if (!seller) {
        throw new CustomError(400, 'Invalid seller ID provided');
      }

      // Create Product
      const product: any = await this.model.create([payload], { session });

      // Create corresponding Purchase record
      await Purchase.create(
        [
          {
            user: userId,
            seller: product[0]?.seller,
            product: product[0]?._id,
            sellerName: seller.name,
            productName: product[0]?.name,
            quantity: Number(product[0]?.stock),
            unitPrice: Number(product[0]?.price),
            totalPrice: Number(product[0]?.stock) * Number(product[0]?.price),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return product;
    } catch (error) {
      console.error('Error during product creation:', error);
      await session.abortTransaction();
      throw new CustomError(400, `Product create failed: ${error.message}`);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Count Total Product
   */
  async countTotalProduct(userId: string) {
    return this.model.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$stock' },
        },
      },
      {
        $project: {
          totalQuantity: 1,
          _id: 0,
        },
      },
    ]);
  }

  /**
   * Get All products of user
   */
  async readAll(query: Record<string, unknown> = {}, userId: string) {
    let data = await this.model.aggregate([
      ...matchStagePipeline(query, userId),
      ...sortAndPaginatePipeline(query),
    ]);

    const totalCount = await this.model.aggregate([
      ...matchStagePipeline(query, userId),
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);

    data = await this.model.populate(data, { path: 'category', select: '-__v -user' });
    data = await this.model.populate(data, { path: 'brand', select: '-__v -user' });
    data = await this.model.populate(data, { path: 'seller', select: '-__v -user -createdAt -updatedAt' });

    return { data, totalCount };
  }

  /**
   * Get Single product of user
   */
  async read(id: string, userId: string) {
    await this._isExists(id);
    return this.model.findOne({ user: new Types.ObjectId(userId), _id: id });
  }

  /**
   * Multiple delete
   */
  async bulkDelete(payload: string[]) {
    const data = payload.map((item) => new Types.ObjectId(item));

    return this.model.deleteMany({ _id: { $in: data } });
  }

  /**
   * Add to stock
   */
  async addToStock(id: string, payload: Pick<IProduct, 'seller' | 'stock'>, userId: string) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const seller = await Seller.findById(payload.seller);
      if (!seller) {
        throw new CustomError(400, 'Invalid seller ID provided');
      }

      const product: any = await this.model.findByIdAndUpdate(
        id,
        { $inc: { stock: payload.stock } },
        { session }
      );

      if (!product) {
        throw new CustomError(404, 'Product not found');
      }

      await Purchase.create(
        [
          {
            user: userId,
            seller: product.seller,
            product: product._id,
            sellerName: seller.name,
            productName: product.name,
            quantity: Number(payload.stock),
            unitPrice: Number(product.price),
            totalPrice: Number(payload.stock) * Number(product.price),
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return product;
    } catch (error) {
      console.error('Error during stock update:', error);
      await session.abortTransaction();
      throw new CustomError(400, `Stock update failed: ${error.message}`);
    } finally {
      await session.endSession();
    }
  }
}

const productServices = new ProductServices(Product, 'Product');
export default productServices;
