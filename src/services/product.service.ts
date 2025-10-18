import { prisma } from '../utils/prisma';

export interface CreateProductData {
  product: string;
  warranty: string;
  price: number;
  discount?: number;
}

export interface UpdateProductData {
  product?: string;
  warranty?: string;
  price?: number;
  discount?: number;
}

export class ProductService {
  async createProduct(data: CreateProductData) {
    return await prisma.product.create({
      data: {
        product: data.product,
        warranty: data.warranty,
        price: data.price,
        discount: data.discount || 0,
      },
    });
  }

  async getProductById(id: string) {
    return await prisma.product.findUnique({
      where: { id },
    });
  }

  async getAllProducts() {
    return await prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProduct(id: string, data: UpdateProductData) {
    const updateData: any = {};
    
    if (data.product !== undefined) updateData.product = data.product;
    if (data.warranty !== undefined) updateData.warranty = data.warranty;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.discount !== undefined) updateData.discount = data.discount;

    return await prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteProduct(id: string) {
    return await prisma.product.delete({
      where: { id },
    });
  }


  async getProductsByPriceRange(minPrice: number, maxPrice: number) {
    return await prisma.product.findMany({
      where: {
        price: {
          gte: minPrice,
          lte: maxPrice,
        },
      },
      orderBy: { price: 'asc' },
    });
  }

  async getProductsList() {
    return await prisma.product.findMany({
      select: {
        id: true,
        product: true,
        warranty: true,
        price: true,
        discount: true,
      },
      orderBy: { product: 'asc' },
    });
  }
}
