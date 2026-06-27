import { Request, Response } from 'express';
import { ProductService, CreateProductData, UpdateProductData } from '../services/product.service';
import { productImportService } from '../services/productImport.service';
import { productExportService } from '../services/productExport.service';
import { getActorUserId } from '../utils/requestUser';
import { parseExportFormat, sendSpreadsheetExport } from '../utils/spreadsheetExport.util';

const productService = new ProductService();

export async function createProductController(req: Request, res: Response) {
  try {
    const { name, code, warranty, onPaperRate, price, discount } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({
        message: 'name and price are required'
      });
    }

    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({
        message: 'Price must be a valid positive number'
      });
    }

    if (discount !== undefined && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
      return res.status(400).json({
        message: 'Discount must be a valid number between 0 and 100'
      });
    }

    const productData: CreateProductData = {
      name,
      code,
      warranty,
      onPaperRate,
      price,
      discount,
    };

    const createdProduct = await productService.createProduct(productData, getActorUserId(res));
    return res.status(201).json(createdProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getProductByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const product = await productService.getProductById(id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllProductsController(req: Request, res: Response) {
  try {
    const products = await productService.getAllProducts();
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateProductController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, code, warranty, onPaperRate, price, discount } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Validate price if provided
    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({
        message: 'Price must be a valid positive number'
      });
    }

    // Validate discount if provided
    if (discount !== undefined && (typeof discount !== 'number' || discount < 0 || discount > 100)) {
      return res.status(400).json({
        message: 'Discount must be a valid number between 0 and 100'
      });
    }

    const updateData: UpdateProductData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (warranty !== undefined) updateData.warranty = warranty;
    if (onPaperRate !== undefined) updateData.onPaperRate = onPaperRate;
    if (price !== undefined) updateData.price = price;
    if (discount !== undefined) updateData.discount = discount;

    const updatedProduct = await productService.updateProduct(id, updateData, getActorUserId(res));
    return res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteProductController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await productService.deleteProduct(id, getActorUserId(res));
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


export async function getProductsByPriceRangeController(req: Request, res: Response) {
  try {
    const { minPrice, maxPrice } = req.query;

    if (!minPrice || !maxPrice) {
      return res.status(400).json({ message: 'minPrice and maxPrice are required' });
    }

    const min = parseFloat(minPrice as string);
    const max = parseFloat(maxPrice as string);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max) {
      return res.status(400).json({
        message: 'minPrice and maxPrice must be valid positive numbers, and minPrice must be less than or equal to maxPrice'
      });
    }

    const products = await productService.getProductsByPriceRange(min, max);
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products by price range:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getProductsListController(req: Request, res: Response) {
  try {
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 50;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const result = await productService.getProductsList(page, limit, search);
    return res.json(result);
  } catch (error) {
    console.error('Error fetching products list:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function importProductsFileController(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const result = await productImportService.importFromFile(
      file.buffer,
      file.originalname,
      getActorUserId(res),
    );
    return res.status(200).json({
      message: `Imported ${result.summary.created} created, ${result.summary.updated} updated`,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Product import error:', error);
    const message = error instanceof Error ? error.message : 'Product import failed';
    return res.status(400).json({ message });
  }
}

export async function exportProductsController(req: Request, res: Response) {
  try {
    const format = parseExportFormat(req.query.format, 'csv');
    const buffer = await productExportService.exportImportFormat(format);
    sendSpreadsheetExport(res, buffer, 'products_export', format);
  } catch (error: unknown) {
    console.error('Product export error:', error);
    return res.status(500).json({ message: 'Failed to export products' });
  }
}
