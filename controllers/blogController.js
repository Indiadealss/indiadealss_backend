import Blog from "../models/Blog.js";

// @route   POST /api/blogs
// @desc    Create a new blog (with thumbnail + cover uploaded to S3 via multer)
export const createBlog = async (req, res) => {
  try {
    let { blogName, slug, category, description, content,links } = req.body;

    if (!blogName || !slug || !category || !description || !content) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // req.files comes from upload.fields([{ name: "thumbnail" }, { name: "cover" }])
    const thumbnail = req.files?.thumbnail?.[0]?.location || null;
    const cover = req.files?.cover?.[0]?.location || null;

    const fileKey = `https://d3eoh63gynpjzh.cloudfront.net/${req.files.thumbnail?.[0].key}`;
    const coverFileKey =`https://d3eoh63gynpjzh.cloudfront.net/${req.files.cover?.[0].key}`;

    let slugLink = `blog/slug${links}`

    if (typeof links === "string") {
  links = JSON.parse(links);
  slugLink = `blog/slug${links}`
}

    // const thumbnail = `https://d3eoh63gynpjzh.cloudfront.net/`

    const blog = await Blog.create({
      blogName,
      slug:slugLink,
      category,
      description,
      content,
      links,
      thumbnail:fileKey,
      cover:coverFileKey,
    });

    return res.status(201).json({
      success: true,
      message: "Blog published successfully",
      data: blog,
    });
  } catch (error) {
    console.error("Error creating blog:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A blog with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong while creating the blog",
    });
  }
};

// @route   GET /api/blogs
// @desc    Get all blogs
export const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: blogs });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching blogs",
    });
  }
};

// @route   GET /api/blogs/:id
// @desc    Get single blog by id
export const getBlogById = async (req, res) => {
  try {

    console.log(req.params.slug);
    
    const location = req.params.slug;

    const slug = `/blog/${location}`
    console.log(slug, 'slug is defined');
    
    const blog = await Blog.findOne({slug});
    if (!blog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    return res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error("Error fetching blog:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while fetching the blog",
    });
  }
};
