import { prisma } from '../utils/prisma';

export interface CreateProductData {
  name: string;
  code?: string;
  warranty?: string;
  price: number;
  discount?: number;
}

export interface UpdateProductData {
  name?: string;
  code?: string;
  warranty?: string;
  price?: number;
  discount?: number;
}

export class ProductService {
  async createProduct(data: CreateProductData) {
    return await prisma.product.create({
      data: {
        name: data.name,
        code: data.code,
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
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
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

  async getProductsList(page: number = 0, limit: number = 50, search?: string) {
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(0, page);
    const where: any = {};

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.product.count({ where });
    const skip = safePage * safeLimit;

    if (skip >= total) {
      return {
        data: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
        },
      };
    }

    const data = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        warranty: true,
        price: true,
        discount: true,
      },
      orderBy: { name: 'asc' },
      skip,
      take: safeLimit,
    });

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
      },
    };
  }
}
