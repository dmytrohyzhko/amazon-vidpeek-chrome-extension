(function ($) {
  var get_el = function (ctx, s, fn) {
    var val = "";
    for (var i = 0; i < s.length; i++) {
      var el = $(s[i], ctx);
      if (el.length > 0 && el[fn] && (val = el.first()[fn]())) {
        return val;
      }
    }
    return val;
  };
  var get_asin = function (ctx) {
    return get_el(
      ctx,
      ["input#ASIN", "input#attach-baseAsin", 'input[name="designAsin"]'],
      "val"
    );
  };
  var return_text = function (e) {
    return e.text();
  };

  function collectStatic(doc, callback) {
    var asin = get_asin(doc);
    var title = get_el(doc, ["#productTitle", "h1#title"], "text").trim();
    var price = get_el(
      doc,
      ["#centerCol .a-price .a-offscreen", "#gc-buy-box .a-color-price"],
      "text"
    );
    if (!price) {
      price = doc.find("#twister-plus-price-data-price").val();
    }
    var image = doc
      .find("#landingImage, #img-canvas img, #ebooks-img-canvas img")
      .attr("src");
    var review_count = get_el(
      doc,
      [
        "#acrCustomerReviewText",
        '#gc-detail-page-center-column a[href*="/product-reviews/"]',
      ],
      "text"
    );

    var category_name,
      category,
      category_el = doc.find("#searchDropdownBox option:selected");
    if ((category = category_el.val())) {
      category = category.replace("search-alias=", "");
      category_name = category_el.text();
    }

    var best_sellers_rank = [];
    var best_sellers_rank_el = doc
      .find(
        "#productDetails_feature_div,#detailBulletsWrapper_feature_div,#productDetails_detailBullets_sections1,#productDetails_flatSectionTables,#gc-dp-btf-product-features"
      )
      .find('a[href*="/bestsellers/"]');

    if (category === "all" || category === "aps") {
      var category2,
        category2el = best_sellers_rank_el.first();
      if (category2el && (category2 = category2el.attr("href"))) {
        category2 = category2.match(/sellers\/([^\/]+)\//);
        if (category2) {
          category = category2[1];
          category_name = category2el.text().split(/\s(in|en)\s/);
          if (category_name.length > 1) {
            category_name = category_name[category_name.length - 1];
          } else {
            category_name = category;
          }
        }
      }
    }

    best_sellers_rank_el.each(function (i, el) {
      try {
        var t = $(el),
          s = t.parent().text().split(/#|nº/)[1].split(" ");
        best_sellers_rank.push([
          parseInt(s[0].replace(/\D+/g, "")),
          s.slice(2).join(" ").split("(")[0],
          t.prop("href"),
        ]);
      } catch (e) {}
    });
    best_sellers_rank.sort(function (a, b) {
      if (a[0] === b[0]) {
        return 0;
      } else {
        return a[0] < b[0] ? -1 : 1;
      }
    });

    var marketplace_id = doc.querySelector('head').innerText.match(/ue_mid.+'(\w+)/);
    marketplace_id = marketplace_id ? marketplace_id[1] : "";

    var rating = parseFloat(doc.querySelector("#acrPopover") ? doc.querySelector("#acrPopover").getAttribute("title") : '');

    var data = {
      name: title,
      price: price,
      asin: asin,
      category: category,
      category_name: category_name,
      image: image,
      url: "https://www.amazon.com/dp/" + asin,
      rating: rating,
      marketplace_id: marketplace_id,
      review_count: review_count
        ? parseInt(review_count.replace(/,/g, "") || "", 10)
        : 0,
      best_sellers_rank: best_sellers_rank,
    };

    var influencer_video_count = 0,
      related_video_count = 0,
      related_influencer_count = 0,
      bottom_carousel_videos = [];
    doc
      .find("#vse-vw-dp-vse-related-videos li.a-carousel-card > div")
      .each(function (author_url, el) {
        var e = $(el),
          title = e.attr("data-title"),
          image = e.attr("data-video-image-url-unchanged"),
          url = "https://www.amazon.com" + e.attr("data-vdp-url"),
          author_name = e.attr("data-vendor-name").trim(),
          author_url = e.attr("data-profile-link");

        var is_influencer =
          "influencer" === (e.attr("data-creator-type") || "").toLowerCase();
        var is_related_video =
          "rvs_g2" === (e.attr("data-group-type") || "").toLowerCase();

        is_influencer && influencer_video_count++;
        is_related_video && related_video_count++;
        is_related_video && is_influencer && related_influencer_count++;

        bottom_carousel_videos.push({
          title: title || "",
          image: image || "",
          url: url,
          author_name: author_name || "",
          author_url: author_url ? "https://www.amazon.com" + author_url : "",
          is_influencer: is_influencer,
          duration: e.attr("data-formatted-duration") || "",
          is_related_video: is_related_video,
          is_customer_review:
            e.find(".IB_G3").length > 0 ||
            e.find(".G3") > 0 ||
            "rvs_g3" === (e.attr("data-group-type") || "").toLowerCase(),
        });
      });

    data.bottom_carousel = {
      videos: bottom_carousel_videos,
      related_video_count: related_video_count,
      influencer_video_count: influencer_video_count,
      related_influencer_count: related_influencer_count,
    };

    var product_carousels = [];
    doc.find("[data-a-carousel-options]").each(function (i, el) {
      try {
        var e = $(el),
          n = JSON.parse(e.attr("data-a-carousel-options"));

        if (n && (n.initialSeenAsins || n.ajax)) {
          var li = e.find("li"),
            product_carousel = {
              products: [],
              name: "",
              ajax: {
                url: n.ajax ? n.ajax.url : "",
                params: n.ajax ? n.ajax.params : "",
              },
              set_size: n.set_size || "",
            },
            heading = e.find("h2.a-carousel-heading").first().text();

          if (!heading) {
            return;
          }

          product_carousel.name = heading.trim();

          li.each(function (i, el) {
            var elm = $(el);
            var name = get_el(
                elm,
                [
                  ".sponsored-products-truncator-truncated",
                  "a div.p13n-sc-truncate-fallback",
                  ".a-section span.a-size-base",
                ],
                "text"
              ),
              price = get_el(
                elm,
                ["span.a-color-price", ".a-price .a-offscreen"],
                "text"
              ).trim(),
              star = elm.find('i[class*="a-icon-star"]'),
              review_count =
                ((o = star.next().text().trim()),
                o.length ? parseFloat(o.replace(/[^\d.]/g, "")) : 0);
            var o;

            var rating = star.text().trim();
            if (!rating) {
              rating = (star.attr("class") || "").match(/-([\d-]+)/);
              rating = rating ? rating[1] : 0;
            }
            rating = rating ? parseFloat(rating.replace("-", ".")) : 0;

            var image = elm.find("img").prop("src");

            var url = elm.find('a[target="_top"],a.a-link-normal').prop("href");

            var asin = decodeURIComponent(url).match(
              /\/(dp|gp\/product)\/([A-Z0-9]{10})/
            );

            name &&
              asin &&
              product_carousel.products.push({
                name: name,
                price: price,
                review_count: review_count,
                rating: rating,
                image: image,
                asin: asin && asin[2] ? asin[2] : "",
                url: url,
              });
          });
          product_carousel.products.length &&
            product_carousels.push(product_carousel);
        }
      } catch (e) {
        console.log(e);
      }
    });
    data.product_carousels = product_carousels;
    
    const altImagesElement = doc.find("#altImages")[0];
    const hasVideoThumbnail =
      altImagesElement == null
        ? false
        : altImagesElement.querySelector(".videoThumbnail") !== null ||
          altImagesElement.querySelector(".videoBlockIngress") !== null ||
          altImagesElement.querySelector(".videoBlockDarkIngress") !== null;

    debugger;

    if (hasVideoThumbnail) {
      fetch("https://www.amazon.com/vap/ew/subcomponent/relatedvideos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
        body: `{"pageContext":{"page":"DetailPage","placement":"ImageBlock","device":"Desktop","marketplaceID":"${marketplace_id}","locale":"en_US","product":{"contentID":"${asin}","contentIDType":"ASIN"},"video":{"contentID":"02cb97edd0b7477f91da3ae10f9f1d0d","contentIDType":"ASIN","videoURL":"https://m.media-amazon.com/images/S/vse-vms-transcoding-artifact-us-east-1-prod/d8dbcdeb-91e2-4cc9-b94e-60a2f3b59e3c/default.jobtemplate.mp4.480.mp4","imageURL":"https://m.media-amazon.com/images/I/91InKrQg+6L.SX522_.jpg"},"requestId":"7S7W3YY93RJZHT3EZK54","weblabContext":[{"name":"","assignment":"","ignoreForG2S2Key":true}],"metadata":{"ProductTitle":"Voniko - Premium Grade AAA Batteries - 24 Pack - Alkaline Triple A Battery - Ultra Long-Lasting, Leakproof 1.5v Batteries - 10-Year Shelf Life"}},"configuration":{"id":"div-relatedvideos","type":"relatedvideos","binder":"relatedvideos","loader":"lazyload","features":{"features":{"verticalcarousel":"true","hide_default_buttons":"true","first_item_flush_left":"true","pagestate":"dp_vse_rvc","reftagprefix":"dp_vse_ibvc","carouselName":"vse-ib-rvs","count":"16","useLazyLoad":"false","hidePlayIcon":"true","hideCustomerReviewPrefix":"true","cssClass":"vse-hide-carousel-title","manufacturerVendorCodes":"V3MSA, Z7AX4, 137GO","segmentOneHeaderId":"vse_ib_segment_one","segmentTwoHeaderId":"vse_ib_segment_two","segmentThreeHeaderId":"vse_ib_segment_three","segmentOneHeaderDefault":"Videos for this product","segmentTwoHeaderDefault":"Related videos","segmentThreeHeaderDefault":"Customer review videos","includeProfiles":"true","showCustomerReviewMetadata":"true","enableCustomerReviewVideos":"true"}},"sources":{"source":"VideoAdsDataAggregatorService"}}}`,
      })
        .then(return_text)
        .then(function (response) {
          try {
            debugger;

            var e = $($.parseHTML(response));
            var t = e.find(".vse-video-card");
            var influencer_video_count = 0;
            var related_video_count = 0;
            var related_influencer_count = 0;
            var videos = [];
            t.each(function (ind, el) {
              var e = $(el),
                t = e.find(".vse-video-title-text").text().trim(),
                r = e.find(".vse-video-image img").attr("src"),
                n = e.find("a.vse-carousel-item").attr("href"),
                s = e.find(".vse-video-vendorname").text().trim(),
                i = e.find(".vse-creator-profile a").attr("href"),
                a = e.find(".vse-video-duration").text().trim();

              debugger;

              // segment-title-G1 G1 IB_G1
              var is_influencer =
                e.find(".vse-video-influencer-profile").length > 0;

              var is_related_video = e.find(".segment-title-IB_G1").length > 0;
              // var is_related_video =
              //   e.find(".IB_G2").length > 0 || e.find(".G2").length > 0 || e.find("segment-title-IB_G2").length > 0;

              is_influencer && influencer_video_count++;
              is_related_video && related_video_count++;
              is_related_video && n.is_influencer && related_influencer_count++;

              if (is_influencer || is_related_video) {
                videos.push({
                  title: t,
                  image: r,
                  url: "https://www.amazon.com/vdp" + n,
                  author_name: s,
                  author_url: i ? "https://www.amazon.com" + i : "",
                  is_influencer: is_influencer,
                  duration: a,
                  is_related_video: is_related_video,
                  is_customer_review:
                    e.find(".IB_G3").length > 0 || e.find(".G3").length > 0,
                });
              }
            });

            data.top_carousel = {
              videos: videos,
              related_video_count: related_video_count,
              influencer_video_count: influencer_video_count,
              related_influencer_count: related_influencer_count,
            };
            // console.log(data);
          } catch (error) {}
          load1 = 1;
          done();
        })
        .catch(function () {
          load1 = 1;
          done();
        });
    } else {
      data.top_carousel = {
        videos: [],
        related_video_count: 0,
        influencer_video_count: 0,
        related_influencer_count: 0,
      };
      load1 = 1;
      done();
    }

    function ql(e) {
      const t = e.match(/on\s(.*)$/);
      return t ? t[1] : "";
    }
    fetch(
      "https://www.amazon.com/product-reviews/" +
        asin +
        "/ref=cm_cr_arp_d_viewopt_srt?pageNumber=1&sortBy=recent"
    )
      .then(return_text)
      .then(function (response) {
        try {
          var reviews = [];
          var d = $($.parseHTML(response));
          var rating = get_el(
            d,
            [
              '.AverageCustomerReviews i[class*="a-icon-star"] span',
              ".AverageCustomerReviews .a-col-right span",
            ],
            "text"
          );
          if (rating) {
            rating = parseFloat(rating);
            if (rating && rating != data.rating) {
              data.rating = rating;
            }
          }
          d.find(".review").each(function (ind, el) {
            var e = $(el),
              t = e.find(".a-profile-name").text().trim(),
              r = "https://www.amazon.com" + e.find(".a-profile").attr("href"),
              n = e.find(".review-date").text().trim(),
              s = e.find(".review-title").text().trim() || "",
              i = e.find(".review-text").text().trim() || "",
              o = parseInt(e.find(".review-rating").text().trim() || "", 10),
              a = e.find(".a-color-state").length > 0;

            reviews.push({
              author_name: t || "",
              author_url: r,
              date: ql(n || ""),
              title: s,
              text: i,
              rating: o,
              is_verified_purchase: a,
            });
          });
          data.reviews = reviews;
          // console.log(data);
        } catch (error) {}
        load2 = 1;
        done();
      })
      .catch(function () {
        load2 = 1;
        done();
      });
  }

  var product_fetch = function (asin, el, callback) {
    // debugger;
    var ckey = "c-" + asin,
      date_now = Date.now(),
      expire = date_now + 36e5; // (3600000); // 60*60*1000
    chrome.storage.local.get(ckey, function (results) {
      var cache = results[ckey];
      if (cache && cache._at && date_now - cache._at < expire) {
        callback(cache, el);
      } else {
        fetch("https://www.amazon.com/dp/" + asin)
          .then(return_text)
          .then(function (response) {
            // const blob = new Blob([response], { type: "text/html" });
            // const url = URL.createObjectURL(blob);

            // // Create a temporary anchor element to initiate the download
            // const anchor = document.createElement("a");
            // anchor.href = url;
            // anchor.download = asin;

            // // Append the anchor to the document and click it to initiate the download
            // document.body.appendChild(anchor);
            // anchor.click();

            // // Clean up resources
            // URL.revokeObjectURL(url);
            // document.body.removeChild(anchor);

            // debugger;

            collectStatic(
              $(new DOMParser().parseFromString(response, "text/html")),
              function (data) {
                data._at = date_now;
                var store = {};
                store[ckey] = data;
                chrome.storage.local.set(store);
                callback(data, el);
              }
            );
          });
      }
    });
  };

  $(function () {
    var asin = get_asin();

    // Product
    if (asin) {
      var button = $(
        '<div class="aext-btn"><img src="' +
          chrome.runtime.getURL("assets/images/icon-64.png") +
          '" alt="' +
          chrome.i18n.getMessage("extName") +
          '"></div>'
      );
      $("body").append(button);

      var loading =
        '<div class="bloading"><div class="lds-ring"><div></div><div></div><div></div><div></div></div><p>Loading Data</p></div>';
      var aPanel = false;
      var html = "";

      var categories_map = [
        ["luxury", "Luxury Stores", "5"],
        ["luxury-beauty", "Premium Beauty", "5"],
        ["luxurystores", "Luxury Stores", "5"],

        ["garden", "Home & Kitchen", "4"],
        ["tools", "Tools & Home Improvement", "4"],
        ["lawngarden", "Garden & Outdoor", "4"],
        ["pets", "Pet Supplies", "4"],

        ["electronics", "Electronics", "3"],
        ["beauty", "Beauty & Personal Care", "3"],
        ["mi", "Musical Instruments", "3"],
        ["local-services", "Home & Business Services", "3"],

        ["digital-music", "Digital Music", "2.50"],
        ["grocery", "Grocery & Gourmet Food", "2.50"],
        ["digital-video", "Digital Video", "2.50"],

        ["book", "Book", "2.25"],
        ["stripbooks", "Books", "2.25"],
        ["sporting", "Sports & Outdoors", "2.25"],
        ["kitchen", "Kitchen & Dining", "2.25"],
        ["automotive", "Automotive Parts & Accessories", "2.25"],
        ["baby-products", "Baby", "2.25"],

        ["fashion", "Clothing, Shoes & Jewelry", "2"],
        ["fashion-womens", "Womens", "2"],
        ["fashion-womens-shoes", "Womens shoes", "2"],
        ["fashion-mens", "Mens", "2"],
        ["fashion-mens-shoes", "Mens Shoes", "2"],
        ["fashion-girls", "Girls", "2"],
        ["fashion-boys", "Boys", "2"],
        ["fashion-baby", "Baby", "2"],
        ["fashion-luggage", "Luggage & Travel Gear", "2"],
        ["fashion-womens-watches", "Women's Watches", "2"],
        ["fashion-mens-watches", "Men's Watches", "2"],
        ["fashion-girls-watches", "Girls' Watches", "2"],
        ["fashion-boys-watches", "Boys' Watches", "2"],
        ["fashion-womens-accessories", "Women's Accessories", "2"],
        ["fashion-mens-accessories", "Men's Accessories", "2"],
        ["fashion-girls-accessories", "Girl's Accessories", "2"],
        ["fashion-boys-accessories", "Boy's Accessories", "2"],

        ["toys-and-games", "Toys", "1.50"],
        ["amazonfresh", "Amazon Fresh", "1.50"],

        ["computers", "Computers", "1.25"],
        ["movies-tv", "Amazon Fresh", "1.25"],

        ["television", "Television", "1"],

        ["gift-cards", "Gift Cards", "0"],
        ["mobile-apps", "Mobile Apps", "0"],
        ["instant-video", "Prime Video", "0"],
      ];

      button.on("click", function () {
        if (!aPanel) {
          create_panel();
          if (!html) {
            var doc = $(document),
              pp = doc.scrollTop();
            $("html, body")
              .animate({ scrollTop: doc.height() * 2 }, 2000)
              .animate({ scrollTop: 0 }, 1500)
              .animate({ scrollTop: pp }, 500);
            setTimeout(function () {
              collectStatic($(document), function (data) {
                var copy_icon =
                  '<?xml version="1.0" ?><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21,8.94a1.31,1.31,0,0,0-.06-.27l0-.09a1.07,1.07,0,0,0-.19-.28h0l-6-6h0a1.07,1.07,0,0,0-.28-.19.32.32,0,0,0-.09,0A.88.88,0,0,0,14.05,2H10A3,3,0,0,0,7,5V6H6A3,3,0,0,0,3,9V19a3,3,0,0,0,3,3h8a3,3,0,0,0,3-3V18h1a3,3,0,0,0,3-3V9S21,9,21,8.94ZM15,5.41,17.59,8H16a1,1,0,0,1-1-1ZM15,19a1,1,0,0,1-1,1H6a1,1,0,0,1-1-1V9A1,1,0,0,1,6,8H7v7a3,3,0,0,0,3,3h5Zm4-4a1,1,0,0,1-1,1H10a1,1,0,0,1-1-1V5a1,1,0,0,1,1-1h3V7a3,3,0,0,0,3,3h3Z" fill="#6563ff"/></svg>';

                var review_html = "";
                review_html += "<div>";
                review_html += "<div><strong>Reviews</strong></div>";
                var review_total = 0,
                  review_count = 0,
                  dpoint = new Date();
                // dpoint.setDate(dpoint.getDate() - 7);
                dpoint.setHours(0, 0, 0, 0);
                dpoint = dpoint.getTime();
                var _7days_reviews = 0;
                for (var i = 0; i < data.reviews.length; i++) {
                  var review = data.reviews[i];
                  try {
                    var d = Math.ceil(
                      (dpoint - new Date(review.date)) / (1000 * 60 * 60 * 24)
                    );
                    if (d >= 0 && d <= 6) {
                      _7days_reviews++;
                    }
                  } catch (e) {
                    console.log(e);
                  }
                  review_html +=
                    "<div>" + review.rating + " - " + review.date + "</div>";
                  review_total += review.rating;
                  review_count++;
                }
                review_html += "</div>";

                html += "<div>";
                html +=
                  '<button class="aext-related-product">Related products</button>';
                html += "</div>";
                html += '<div class="aext-area1">';
                html += '<div class="aext-meta-wraper apad">';
                html += "<div>";
                html +=
                  "<div><strong>ASIN: </strong><span>" +
                  data.asin +
                  '</span> <button class="aext-copy-button" data-copy="' +
                  data.asin +
                  '">' +
                  copy_icon +
                  "</button></div>";
                html +=
                  "<div><strong>Link: </strong><span>" +
                  data.url +
                  '</span> <button class="aext-copy-button" data-copy="' +
                  data.url +
                  '">' +
                  copy_icon +
                  "</button></div>";
                html +=
                  "<div><strong>Price: </strong><span>" +
                  data.price +
                  "</span></div>";
                html +=
                  "<div><strong>Rating: </strong><span>" +
                  (data.rating || 0) +
                  '</span><span style="color:#ffa41c">★</span></div>';
                html +=
                  "<div><strong># Ratings: </strong><span>" +
                  data.review_count +
                  "</span></div>";
                html += "</div>";

                var best_sellers_rank = data.best_sellers_rank;
                html += "<div>";
                html +=
                  "<div><strong>Last 7 days #Reviews: </strong>" +
                  _7days_reviews +
                  "</div>";
                // html += '<div>Last 10 reviews avg.: ' + (review_total / review_count).toFixed(2) + '</div>';
                html += "<div><strong>Best sellers rank</strong></div>";
                for (var i = 0; i < best_sellers_rank.length; i++) {
                  var rank = best_sellers_rank[i];
                  html +=
                    '<div><a href="' +
                    rank[2] +
                    '">#' +
                    rank[0] +
                    " - " +
                    rank[1] +
                    "</a></div>";
                }
                html += "</div>";
                html += "</div>";

                html += "<table>";

                html += "<thead>";
                html += "<tr>";
                html += "<th></th>";
                html += "<th>Merchant Videos</th>";
                html += "<th>Influencer Videos</th>";
                html += "<th>Total Videos</th>";
                html += "</tr>";
                html += "</thead>";

                html += "<tbody>";
                html += "<tr>";
                html += "<td><strong>Top Carrousel</strong></td>";
                html +=
                  "<td>" +
                  (data.top_carousel.videos.length -
                    data.top_carousel.influencer_video_count) +
                  "</td>";
                html +=
                  "<td>" + data.top_carousel.influencer_video_count + "</td>";
                html += "<td>" + data.top_carousel.videos.length + "</td>";
                html += "</tr>";
                html += "<tr>";
                html += "<td><strong>Bottom Carrousel</strong></td>";
                html +=
                  "<td>" +
                  (data.bottom_carousel.videos.length -
                    data.bottom_carousel.influencer_video_count) +
                  "</td>";
                html +=
                  "<td>" +
                  data.bottom_carousel.influencer_video_count +
                  "</td>";
                html += "<td>" + data.bottom_carousel.videos.length + "</td>";
                html += "</tr>";
                html += "</tbody>";

                html += "</table>";

                var category_percentage = "4";
                for (var i = 0; i < categories_map.length; i++) {
                  if (categories_map[i][0] == data.category) {
                    category_percentage = categories_map[i][2];
                  }
                }
                var category_label = data.category_name;

                var estimated = parseInt(data.price.replace(/[\D\.]+/, ""));
                estimated = (estimated * category_percentage) / 100;

                html += '<table class="extbb">';
                html += "<tr>";
                html +=
                  "<td><strong>Category:</strong> <span>" +
                  category_label +
                  "</span></td>";
                html +=
                  "<td><strong>Comission % in <span>" +
                  category_label +
                  "</span> = </strong><span>" +
                  category_percentage +
                  "</span>%</td>";
                html +=
                  '<td style="background:#7fff7f">Estimated Comission for this product: <strong>$' +
                  estimated +
                  "</strong></td>";
                html += "</tr>";
                html += "</table>";

                // html += review_html;

                html += "</div>";

                html += '<div class="aext-area2" style="display:none">';
                html +=
                  '<table id="tableAextRelatedProducts" class="aext-related-products">';
                html += "<thead>";
                html += "<tr>";
                html += "<th>Image</th>";
                html += "<th>ASIN</th>";
                html +=
                  '<th>Price<span id="btnSortByPrice" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html += '<th>Rating<span style="color:#ffa41c">★</span></th>';
                html +=
                  '<th>Review Count<span id="btnSortByReviews" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html +=
                  '<th data-tooltip="Total Videos">TV <span class="ii">i</span><span id="btnSortByTV" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html +=
                  '<th data-tooltip="Merchant Videos">MV <span class="ii">i</span></th>';
                html +=
                  '<th data-tooltip="Influencer Videos">IV <span class="ii">i</span></th>';
                html +=
                  '<th data-tooltip="Estimated Commission per Sale">ECS <span class="ii">i</span><span id="btnSortByECS" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html += "</tr>";
                html += "</thead>";

                html += "<tbody>";
                for (var i = 0; i < data.product_carousels.length; i++) {
                  var product_carousel = data.product_carousels[i];
                  for (var j = 0; j < product_carousel.products.length; j++) {
                    var product = product_carousel.products[j];

                    html +=
                      '<tr class="loading" data-asin="' + product.asin + '">';
                    html +=
                      '<td><a href="https://www.amazon.com/dp/' +
                      product.asin +
                      '" target="_blank"><img src="' +
                      product.image +
                      '"></a></td>';
                    html +=
                      '<td><a href="https://www.amazon.com/dp/' +
                      product.asin +
                      '" target="_blank">' +
                      product.asin +
                      "</a>";
                    // html += '<button class="aext-copy-button" data-copy="' + product.asin + '">' + copy_icon + '</button></td>';
                    html += "</td>";
                    html += "<td>" + product.price + "</td>";
                    html += '<td class="rt">' + product.rating + "</td>";
                    html += "<td>" + product.review_count + "</td>";
                    html += '<td class="tv"></td>';
                    html += '<td class="mv"></td>';
                    html += '<td class="iv"></td>';
                    html += '<td class="ecs"></td>';
                    html += "</tr>";
                  }
                }
                html += "</tbody>";

                html += "</table>";
                html += "</div>";
                // console.log(html);

                update_panel();
                // aPanel.normalize();
              });
            }, 4500);
          }
        }
      });

      var create_panel = function () {
        if (aPanel === false) {
          jsPanel.ziBase = 9999;
          aPanel = jsPanel.create({
            // theme: 'light',
            theme: {
              bgPanel: "#0168f8",
              bgContent: "#fff",
              colorHeader: "#fff",
              border: "thin solid #0168f8",
              borderRadius: ".33rem",
            },
            headerLogo:
              '<img src="' +
              chrome.runtime.getURL("assets/images/icon-16.png") +
              '" alt="' +
              chrome.i18n.getMessage("extName") +
              '">',
            headerTitle: "VidPeek",
            syncMargins: true,
            // container: "window",
            // onwindowresize: true,
            // contentSize: '300 200',
            panelSize: {
              width: () => {
                return Math.min(900, window.innerWidth * 0.9);
              },
              height: () => {
                return Math.min(520, window.innerHeight * 0.8);
              },
            },
            css: {
              panel: "aextPanel",
            },
            // animateIn: 'jsPanelFadeIn',
            content: html || loading,
            onclosed: function () {
              aPanel = false;
            },
          });
          // !html && aPanel.maximize();
        }
      };

      var update_panel = function () {
        aPanel && $(".jsPanel-content", aPanel).html(html);
      };

      $(document).on("click", ".aextPanel button[data-copy]", function (e) {
        navigator.clipboard.writeText($(this).data("copy"));
      });

      $(document).on("click", "#btnSortByReviews", function (e) {
        if ($("#btnSortByReviews").text() === "▼") {
          $("#btnSortByReviews").text("▲");
        } else {
          $("#btnSortByReviews").text("▼");
        }

        sort_related_products_by_column(
          4,
          $("#btnSortByReviews").text() === "▲" ? 2 : 1
        );
      });

      $(document).on("click", "#btnSortByPrice", function (e) {
        if ($("#btnSortByPrice").text() === "▼") {
          $("#btnSortByPrice").text("▲");
        } else {
          $("#btnSortByPrice").text("▼");
        }

        sort_related_products_by_column(
          2,
          $("#btnSortByPrice").text() === "▲" ? 2 : 1
        );
      });

      $(document).on("click", "#btnSortByTV", function (e) {
        if ($("#btnSortByTV").text() === "▼") {
          $("#btnSortByTV").text("▲");
        } else {
          $("#btnSortByTV").text("▼");
        }

        sort_related_products_by_column(
          5,
          $("#btnSortByTV").text() === "▲" ? 2 : 1
        );
      });

      $(document).on("click", "#btnSortByECS", function (e) {
        if ($("#btnSortByECS").text() === "▼") {
          $("#btnSortByECS").text("▲");
        } else {
          $("#btnSortByECS").text("▼");
        }

        sort_related_products_by_column(
          8,
          $("#btnSortByECS").text() === "▲" ? 2 : 1
        );
      });

      var load_recent_products = function () {
        if (recent_products_view) {
          var els = $("table.aext-related-products tr.loading");
          if (els.length > 0) {
            var el = $(els[0], aPanel);
            product_fetch(el.data("asin"), el, function (data, el) {
              // data.top_carousel.related_video_count
              // data.top_carousel.influencer_video_count
              // data.top_carousel.videos.length

              // data.bottom_carousel.related_video_count
              // data.bottom_carousel.influencer_video_count
              // data.bottom_carousel.videos.length

              el.find("td.rt").text(data.rating);
              el.find("td.tv").text(data.top_carousel.videos.length);
              el.find("td.mv").text(
                data.top_carousel.videos.length -
                  data.top_carousel.influencer_video_count
              );
              el.find("td.iv").text(data.top_carousel.influencer_video_count);

              // TODO: Comission for data

              var category_percentage = "4";
              for (var i = 0; i < categories_map.length; i++) {
                if (categories_map[i][0] == data.category) {
                  category_percentage = categories_map[i][2];
                }
              }

              var estimated = parseInt(data.price.replace(/[\D\.]+/, ""));
              estimated = (estimated * category_percentage) / 100;

              el.find("td.ecs").text("$" + estimated);

              el.removeClass("loading");
              load_recent_products();
            });
          }
        }
      };

      var sort_related_products_by_column = function (column, order) {
        const sortOrder = order;
        let table = document.getElementById("tableAextRelatedProducts");

        // Get all the rows within the table body
        let rows = Array.from(table.tBodies[0].rows);

        // Sort the rows based on the content of the first <td> element in each row
        rows.sort((a, b) => {
          if (column === 2 || column === 8) {
            const textA = a.cells[column].innerText.toLowerCase();
            const textB = b.cells[column].innerText.toLowerCase();

            const regex = /[\d.]+/;
            const valueA = textA == "" ? 0 : parseFloat(textA.match(regex)[0]);
            const valueB = textB == "" ? 0 : parseFloat(textB.match(regex)[0]);

            return sortOrder === 1 ? valueA - valueB : valueB - valueA;
          } else {
            const textA = parseFloat(a.cells[column].innerText.toLowerCase());
            const textB = parseFloat(b.cells[column].innerText.toLowerCase());

            return sortOrder === 1 ? textA - textB : textB - textA;
          }
        });

        const newTBody = document.createElement("tbody");
        rows.forEach((row) => {
          newTBody.appendChild(row);
        });

        table.replaceChild(newTBody, table.tBodies[0]);
      };

      var recent_products_view = false;
      $(document).on(
        "click",
        ".aextPanel button.aext-related-product",
        function (e) {
          if (recent_products_view) {
            recent_products_view = false;
            $(".aext-area2", aPanel).hide();
            $(".aext-area1", aPanel).show();
            $(this).text("Related products");
          } else {
            recent_products_view = true;
            $(".aext-area1", aPanel).hide();
            $(".aext-area2", aPanel).show();
            load_recent_products();
            $(this).text("Product details");
          }
        }
      );

      chrome.runtime.onMessage.addListener(function (
        request,
        sender,
        sendResponse
      ) {
        if (request === "open") {
          button.click();
        }
      });
    } else {
      // Search
      const regex = /https:\/\/www\.amazon\.com\/s\?k=/;
      const url = window.location.href;

      if (regex.test(url)) {
        var button = $(
          '<div class="aext-btn"><img src="' +
            chrome.runtime.getURL("assets/images/icon-64.png") +
            '" alt="' +
            chrome.i18n.getMessage("extName") +
            '"></div>'
        );
        $("body").append(button);

        var loading =
          '<div class="bloading"><div class="lds-ring"><div></div><div></div><div></div><div></div></div><p>Loading Data</p></div>';
        var aPanel = false;
        var html = "";
        var best_products = [];

        var categories_map = [
          ["luxury", "Luxury Stores", "5"],
          ["luxury-beauty", "Premium Beauty", "5"],
          ["luxurystores", "Luxury Stores", "5"],

          ["garden", "Home & Kitchen", "4"],
          ["tools", "Tools & Home Improvement", "4"],
          ["lawngarden", "Garden & Outdoor", "4"],
          ["pets", "Pet Supplies", "4"],

          ["electronics", "Electronics", "3"],
          ["beauty", "Beauty & Personal Care", "3"],
          ["mi", "Musical Instruments", "3"],
          ["local-services", "Home & Business Services", "3"],

          ["digital-music", "Digital Music", "2.50"],
          ["grocery", "Grocery & Gourmet Food", "2.50"],
          ["digital-video", "Digital Video", "2.50"],

          ["book", "Book", "2.25"],
          ["stripbooks", "Books", "2.25"],
          ["sporting", "Sports & Outdoors", "2.25"],
          ["kitchen", "Kitchen & Dining", "2.25"],
          ["automotive", "Automotive Parts & Accessories", "2.25"],
          ["baby-products", "Baby", "2.25"],

          ["fashion", "Clothing, Shoes & Jewelry", "2"],
          ["fashion-womens", "Womens", "2"],
          ["fashion-womens-shoes", "Womens shoes", "2"],
          ["fashion-mens", "Mens", "2"],
          ["fashion-mens-shoes", "Mens Shoes", "2"],
          ["fashion-girls", "Girls", "2"],
          ["fashion-boys", "Boys", "2"],
          ["fashion-baby", "Baby", "2"],
          ["fashion-luggage", "Luggage & Travel Gear", "2"],
          ["fashion-womens-watches", "Women's Watches", "2"],
          ["fashion-mens-watches", "Men's Watches", "2"],
          ["fashion-girls-watches", "Girls' Watches", "2"],
          ["fashion-boys-watches", "Boys' Watches", "2"],
          ["fashion-womens-accessories", "Women's Accessories", "2"],
          ["fashion-mens-accessories", "Men's Accessories", "2"],
          ["fashion-girls-accessories", "Girl's Accessories", "2"],
          ["fashion-boys-accessories", "Boy's Accessories", "2"],

          ["toys-and-games", "Toys", "1.50"],
          ["amazonfresh", "Amazon Fresh", "1.50"],

          ["computers", "Computers", "1.25"],
          ["movies-tv", "Amazon Fresh", "1.25"],

          ["television", "Television", "1"],

          ["gift-cards", "Gift Cards", "0"],
          ["mobile-apps", "Mobile Apps", "0"],
          ["instant-video", "Prime Video", "0"],
        ];

        button.on("click", function () {
          if (!aPanel) {
            create_panel();
            if (!html) {
              var doc = $(document),
                pp = doc.scrollTop();
              $("html, body")
                .animate({ scrollTop: doc.height() * 2 }, 2000)
                .animate({ scrollTop: 0 }, 1500)
                .animate({ scrollTop: pp }, 500);
              setTimeout(function () {
                html +=
                  '<button class="aext-related-product">3 Best Products</button>';

                html += '<div class="aext-area2" style="display: none">';
                html +=
                  '<table id="tableAext3BestProducts" class="aext-related-products">';
                html += "<thead>";
                html += "<tr>";
                html += "<th>Image</th>";
                html += "<th>ASIN</th>";
                html += "<th>Price</th>";
                html += '<th>Rating<span style="color:#ffa41c">★</span></th>';
                html += "<th>Review Count</th>";
                html += '<th data-tooltip="Total Videos">TV</th>';
                html +=
                  '<th data-tooltip="Estimated Commission per Sale">ECS<span class="ii">i</span></th>';
                html += "</tr>";
                html += "</thead>";
                html += "<tbody>";
                html += "</tbody>";
                html += "</table>";
                html += "</div>";

                var pdList = [];
                var container = document.querySelector(
                  ".s-main-slot.s-result-list.s-search-results.sg-row"
                );
                if (!container) return;

                var elements = container.querySelectorAll(
                  '[data-asin]:not([data-asin=""])'
                );
                elements.forEach((element) => {
                  try {
                    const dataAsin = $(element).attr("data-asin");
                    const imageUrl = element
                      .querySelectorAll("img")[0]
                      .getAttribute("src");
                    const price =
                      element.querySelector(".a-offscreen").innerText;
                    const rating = parseFloat(
                      element.querySelector(
                        ".a-icon.a-icon-star-small.a-star-small-4-5.aok-align-bottom"
                      ).innerText
                    );
                    const review_count = 0;

                    pdList.push({
                      asin: dataAsin,
                      image: imageUrl,
                      price,
                      rating,
                      review_count,
                    });
                  } catch (err) {}
                });

                // const dataAsinList = [];
                // $('.s-main-slot .s-result-list .sg-row [data-asin]').each(function() {

                // 	dataAsinList.push(dataAsin);
                // });

                html += '<div class="aext-area1">';
                html +=
                  '<table id="tableAextSearchedProducts" class="aext-related-products">';
                html += "<thead>";
                html += "<tr>";
                html += "<th>Image</th>";
                html += "<th>ASIN</th>";
                html +=
                  '<th>Price<span id="btnSortByPrice" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html += '<th>Rating<span style="color:#ffa41c">★</span></th>';
                html +=
                  '<th>Review Count<span id="btnSortByReviews" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html +=
                  '<th data-tooltip="Total Videos">TV <span class="ii">i</span><span id="btnSortByTV" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html +=
                  '<th data-tooltip="Merchant Videos">MV <span class="ii">i</span></th>';
                html +=
                  '<th data-tooltip="Influencer Videos">IV <span class="ii">i</span></th>';
                html +=
                  '<th data-tooltip="Estimated Commission per Sale">ECS <span class="ii">i</span><span id="btnSortByECS" style="color:#ffa41c; cursor: pointer;">▼</span></th>';
                html += "</tr>";
                html += "</thead>";

                html += "<tbody>";

                // ASIN:
                // Link:
                // Price:
                // Rating:
                // # Ratings:

                for (var i = 0; i < pdList.length; i++) {
                  const product = pdList[i];
                  html +=
                    '<tr class="loading" data-asin="' + product.asin + '">';
                  html +=
                    '<td><a href="https://www.amazon.com/dp/' +
                    product.asin +
                    '" target="_blank"><img src="' +
                    product.image +
                    '"></a></td>';
                  html +=
                    '<td><a href="https://www.amazon.com/dp/' +
                    product.asin +
                    '" target="_blank">' +
                    product.asin +
                    "</a>";
                  html += "</td>";
                  html += "<td>" + product.price + "</td>";
                  html += '<td class="rt">' + product.rating + "</td>";
                  html +=
                    '<td class="reviewCount">' + product.review_count + "</td>";
                  html += '<td class="tv"></td>';
                  html += '<td class="mv"></td>';
                  html += '<td class="iv"></td>';
                  html += '<td class="ecs"></td>';
                  html += "</tr>";
                }
                html += "</tbody>";

                html += "</table>";
                html += "</div>";
                // console.log(html);

                update_panel();
                // aPanel.normalize();

                load_searched_results();
              }, 4500);
            }
          }
        });

        var create_panel = function () {
          if (aPanel === false) {
            jsPanel.ziBase = 9999;
            aPanel = jsPanel.create({
              // theme: 'light',
              theme: {
                bgPanel: "#0168f8",
                bgContent: "#fff",
                colorHeader: "#fff",
                border: "thin solid #0168f8",
                borderRadius: ".33rem",
              },
              headerLogo:
                '<img src="' +
                chrome.runtime.getURL("assets/images/icon-16.png") +
                '" alt="' +
                chrome.i18n.getMessage("extName") +
                '">',
              headerTitle: "VidPeek",
              syncMargins: true,
              // container: "window",
              // onwindowresize: true,
              // contentSize: '300 200',
              panelSize: {
                width: () => {
                  return Math.min(900, window.innerWidth * 0.9);
                },
                height: () => {
                  return Math.min(520, window.innerHeight * 0.8);
                },
              },
              css: {
                panel: "aextPanel",
              },
              // animateIn: 'jsPanelFadeIn',
              content: html || loading,
              onclosed: function () {
                aPanel = false;
              },
            });
            // !html && aPanel.maximize();
          }
        };

        var update_panel = function () {
          aPanel && $(".jsPanel-content", aPanel).html(html);
        };

        $(document).on("click", ".aextPanel button[data-copy]", function (e) {
          navigator.clipboard.writeText($(this).data("copy"));
        });

        $(document).on("click", "#btnSortByReviews", function (e) {
          if ($("#btnSortByReviews").text() === "▼") {
            $("#btnSortByReviews").text("▲");
          } else {
            $("#btnSortByReviews").text("▼");
          }

          sort_related_products_by_column(
            4,
            $("#btnSortByReviews").text() === "▲" ? 2 : 1
          );
        });

        $(document).on("click", "#btnSortByPrice", function (e) {
          if ($("#btnSortByPrice").text() === "▼") {
            $("#btnSortByPrice").text("▲");
          } else {
            $("#btnSortByPrice").text("▼");
          }

          sort_related_products_by_column(
            2,
            $("#btnSortByPrice").text() === "▲" ? 2 : 1
          );
        });

        $(document).on("click", "#btnSortByTV", function (e) {
          if ($("#btnSortByTV").text() === "▼") {
            $("#btnSortByTV").text("▲");
          } else {
            $("#btnSortByTV").text("▼");
          }

          sort_related_products_by_column(
            5,
            $("#btnSortByTV").text() === "▲" ? 2 : 1
          );
        });

        $(document).on("click", "#btnSortByECS", function (e) {
          if ($("#btnSortByECS").text() === "▼") {
            $("#btnSortByECS").text("▲");
          } else {
            $("#btnSortByECS").text("▼");
          }

          sort_related_products_by_column(
            8,
            $("#btnSortByECS").text() === "▲" ? 2 : 1
          );
        });

        var best_product_view = false;
        $(document).on(
          "click",
          ".aextPanel button.aext-related-product",
          function (e) {
            if (best_product_view) {
              best_product_view = false;
              $(".aext-area2", aPanel).hide();
              $(".aext-area1", aPanel).show();
              $(this).text("3 Best Products");
            } else {
              best_product_view = true;
              $(".aext-area1", aPanel).hide();
              $(".aext-area2", aPanel).show();
              $(this).text("Searched Products");
            }
          }
        );

        var productInfomations = [];

        var load_searched_results = function () {
          var els = $("table.aext-related-products tr.loading");
          if (els.length > 0) {
            for (var i = 0; i < els.length; i++) {
              var el = $(els[i], aPanel);
              product_fetch(el.data("asin"), el, function (data, el) {
                // data.top_carousel.related_video_count
                // data.top_carousel.influencer_video_count
                // data.top_carousel.videos.length

                // data.bottom_carousel.related_video_count
                // data.bottom_carousel.influencer_video_count
                // data.bottom_carousel.videos.length

                el.find("td.rt").text(data.rating);
                el.find("td.tv").text(data.top_carousel.videos.length);
                el.find("td.mv").text(
                  data.top_carousel.videos.length -
                    data.top_carousel.influencer_video_count
                );
                el.find("td.iv").text(data.top_carousel.influencer_video_count);
                el.find("td.reviewCount").text(data.review_count);

                // TODO: Comission for data

                var category_percentage = "4";
                for (var i = 0; i < categories_map.length; i++) {
                  if (categories_map[i][0] == data.category) {
                    category_percentage = categories_map[i][2];
                  }
                }

                var estimated = parseInt(data.price.replace(/[\D\.]+/, ""));
                estimated = (estimated * category_percentage) / 100;

                data.estimated = estimated;

                el.find("td.ecs").text("$" + estimated);

                el.removeClass("loading");

                productInfomations.push(data);

                if (productInfomations.length > els.length / 2) {
                  productInfomations.sort((a, b) => {
                    const valueA = a.estimated;
                    const valueB = b.estimated;

                    return valueB - valueA;
                  });

                  best_products = productInfomations.slice(
                    0,
                    Math.min(productInfomations.length, 3)
                  );

                  var tbody = "";
                  best_products.forEach((product) => {
                    tbody += '<tr data-asin="' + product.asin + '">';
                    tbody +=
                      '<td><a href="https://www.amazon.com/dp/' +
                      product.asin +
                      '" target="_blank"><img src="' +
                      product.image +
                      '"></a></td>';
                    tbody +=
                      '<td><a href="https://www.amazon.com/dp/' +
                      product.asin +
                      '" target="_blank">' +
                      product.asin +
                      "</a>";
                    tbody += "</td>";
                    tbody += "<td>" + product.price + "</td>";
                    tbody += '<td class="rt">' + product.rating + "</td>";
                    tbody +=
                      '<td class="reviewCount">' +
                      product.review_count +
                      "</td>";
                    tbody +=
                      "<td>" + product.top_carousel.videos.length + "</td>";
                    tbody += '<td class="ecs">$ ' + product.estimated + "</td>";
                    tbody += "</tr>";
                  });

                  $("#tableAext3BestProducts").find("tbody").html(tbody);
                }
              });
            }
          }
        };

        var sort_related_products_by_column = function (column, order) {
          const sortOrder = order;
          let table = document.getElementById("tableAextSearchedProducts");

          // Get all the rows within the table body
          let rows = Array.from(table.tBodies[0].rows);

          // Sort the rows based on the content of the first <td> element in each row
          rows.sort((a, b) => {
            if (column === 2 || column === 8) {
              const textA = a.cells[column].innerText.toLowerCase();
              const textB = b.cells[column].innerText.toLowerCase();

              const regex = /[\d.]+/;
              const valueA =
                textA == "" ? 0 : parseFloat(textA.match(regex)[0]);
              const valueB =
                textB == "" ? 0 : parseFloat(textB.match(regex)[0]);

              return sortOrder === 1 ? valueA - valueB : valueB - valueA;
            } else {
              const textA = parseFloat(a.cells[column].innerText.toLowerCase());
              const textB = parseFloat(b.cells[column].innerText.toLowerCase());

              return sortOrder === 1 ? textA - textB : textB - textA;
            }
          });

          const newTBody = document.createElement("tbody");
          rows.forEach((row) => {
            newTBody.appendChild(row);
          });

          table.replaceChild(newTBody, table.tBodies[0]);
        };

        chrome.runtime.onMessage.addListener(function (
          request,
          sender,
          sendResponse
        ) {
          if (request === "open") {
            button.click();
          }
        });
      }
    }
  });
})(jQuery);
